import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as archiver from 'archiver';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ZIP_QUEUE, type ZipJobPayload } from './zip.processor';
import { isActiveOrder, pickActiveOrder } from '../../common/access-expiry';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(ZIP_QUEUE) private readonly zipQueue: Queue<ZipJobPayload>,
  ) {}

  // Татах тоолуурын DEDUP cache: нэг (identifier + productId)-ийг богино хугацаанд
  // дахин тоолохгүй (олон дарах / бот спам-аас realDownloadCount хуурамчаар
  // хөөрөхөөс сэргийлнэ). identifier = нэвтэрсэн userId эсвэл public IP.
  private static readonly BUMP_DEDUP_MS = 10 * 60 * 1000; // 10 минут
  private readonly bumpSeen = new Map<string, number>();

  // Бодит таталт тоолуурыг +1. identifier (userId/IP) өгөгдвөл богино хугацаанд
  // ижил хүн дахин татвал тоолохгүй (analytics хуурамч хөөрөхөөс сэргийлнэ).
  // Зөвхөн admin-д харагдана; frontend-ийн "харагдах" downloadCount-д нөлөөлөхгүй.
  // Алдаа гарвал татах урсгалыг таслахгүй (catch).
  private async bumpRealDownload(productId: string, identifier?: string | null) {
    if (identifier) {
      const key = `${identifier}:${productId}`;
      const now = Date.now();
      const last = this.bumpSeen.get(key);
      if (last && now - last < DownloadsService.BUMP_DEDUP_MS) {
        return; // дөнгөж саяхан тоологдсон — давхар тоолохгүй
      }
      this.bumpSeen.set(key, now);
      // Map хэт томрохоос сэргийлж хааяа цэвэрлэнэ (10мин-ээс хуучин бичлэг)
      if (this.bumpSeen.size > 5000) {
        for (const [k, t] of this.bumpSeen) {
          if (now - t > DownloadsService.BUMP_DEDUP_MS) this.bumpSeen.delete(k);
        }
      }
    }
    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: { realDownloadCount: { increment: 1 } },
      });
    } catch {
      /* тоолуурын алдаа татах урсгалд нөлөөлөхгүй */
    }
  }

  // ── Татаалтын ДЭЛГЭРЭНГҮЙ бүртгэл (admin "Татаалт" хуудасны эх сурвалж) ──
  // Хэн (userId эсвэл зочин IP), юу (productId/fileName), хаанаас (ip/userAgent),
  // ямар замаар (source: paid/free/bundle) татсаныг бүртгэнэ. БҮХ татах метод
  // дуудна. Fire-and-forget — алдаа гарвал чимээгүй (татах урсгалд нөлөөлөхгүй).
  private recordDownloadLog(input: {
    productId?: string | null;
    userId?: string | null;
    fileName?: string | null;
    source: 'paid' | 'free' | 'bundle';
    ip?: string | null;
    userAgent?: string | null;
  }) {
    this.prisma.downloadLog
      .create({
        data: {
          productId: input.productId ?? null,
          userId: input.userId ?? null,
          fileName: input.fileName ?? null,
          source: input.source,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      })
      .catch(() => {
        /* бүртгэлийн алдаа татах урсгалд нөлөөлөхгүй (fire-and-forget) */
      });
  }

  // Нэвтэрсэн хэрэглэгчийн татаж авсан файл(ууд)-ыг Download-д бүртгэнэ.
  // Энэ нь admin panel-ийн хэрэглэгчийн "Татсан" түүх болон хэрэглэгчийн
  // татах бүртгэлийн ҮНДЭС — татах БҮХ метод (нэг файл/zip/bundle) дуудах ёстой.
  // Алдаа гарвал татах урсгалыг таслахгүй (fire-and-forget).
  private async recordDownloads(userId: string | null | undefined, fileIds: string[]) {
    if (!userId || !fileIds.length) return;
    const uniqueIds = [...new Set(fileIds.filter(Boolean))];
    if (!uniqueIds.length) return;
    try {
      await this.prisma.download.createMany({
        data: uniqueIds.map((fileId) => ({ userId, fileId })),
      });
    } catch {
      /* бүртгэлийн алдаа татах урсгалд нөлөөлөхгүй */
    }
  }

  async verifyAndGetSignedUrl(
    userId: string,
    fileId: string,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    const file = await this.prisma.productFile.findUnique({
      where: { id: fileId },
      include: { product: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // ── Эзэмшил шалгах ──
    // (1) Файлын эх product-ийг ШУУД эзэмшсэн эсэх, ЭСВЭЛ
    // (2) Энэ fileId нь хэрэглэгчийн эзэмшсэн ЯМАР НЭГЭН bundle-ийн fileIds-д
    //     багтсан эсэх (BundleItem.fileIds нь өөр product-ийн файл байж болно —
    //     bundle худалдсан хэрэглэгч тэр файлыг татах эрхтэй).
    // Шууд эзэмшсэн (PAID) захиалгуудаас ИДЭВХТЭЙ (expiresAt null/future) нэг
    // байгаа эсэх. Бүгд дууссан бол энэ файлыг шууд эрхээр татахыг зөвшөөрөхгүй.
    const directOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId: file.productId } },
      },
      select: { id: true, expiresAt: true },
    });

    let owned = !!pickActiveOrder(directOrders);

    if (!owned) {
      // Хэрэглэгчийн эзэмшсэн бүх product-ийн bundle-уудаас энэ fileId-г хайна.
      // ⚠️ Зөвхөн ИДЭВХТЭЙ (хугацаа дуусаагүй) захиалгын product-уудыг авна —
      // дууссан bundle-ийн cross-product файлыг татах эрхгүй.
      const ownedItems = await this.prisma.orderItem.findMany({
        where: { order: { userId, status: OrderStatus.PAID } },
        select: { productId: true, order: { select: { expiresAt: true } } },
      });
      const ownedProductIds = ownedItems
        .filter((i) => isActiveOrder(i.order))
        .map((i) => i.productId);

      if (ownedProductIds.length) {
        const bundles = await this.prisma.productBundle.findMany({
          where: { productId: { in: ownedProductIds } },
          select: { items: { select: { fileId: true, fileIds: true } } },
        });
        const ownedFileIds = new Set<string>();
        for (const b of bundles) {
          for (const it of b.items) {
            if (it.fileId) ownedFileIds.add(it.fileId);
            for (const fid of it.fileIds ?? []) ownedFileIds.add(fid);
          }
        }
        owned = ownedFileIds.has(fileId);
      }
    }

    if (!owned) {
      throw new ForbiddenException('You do not own this product');
    }

    // recordDownloads helper ашиглана (бусад татах методтой нэгдсэн, dedup-тай).
    await this.recordDownloads(userId, [file.id]);
    await this.bumpRealDownload(file.productId);
    this.recordDownloadLog({
      productId: file.productId,
      userId,
      fileName: file.fileName,
      source: 'paid',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');

    return {
      fileId: file.id,
      fileName: file.fileName,
      url,
      expiresIn: 300,
      generatedAt: Date.now(),
    };
  }

  async streamZipDownload(
    userId: string,
    productId: string,
    res: Response,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!product) throw new NotFoundException('Product not found');

    // Эзэмшил + хандалтын хугацаа (expiresAt) идэвхтэй эсэхийг шалгана.
    await this.assertActiveOwnership(userId, productId);

    if (!product.files.length) throw new NotFoundException('No files to download');

    await this.bumpRealDownload(productId);
    await this.recordDownloads(userId, product.files.map((f) => f.id));
    this.recordDownloadLog({
      productId,
      userId,
      fileName: `${product.title} (бүх файл).zip`,
      source: 'paid',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const zipName = `${product.slug ?? productId}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const zip = archiver.default('zip', { zlib: { level: 6 } });
    zip.pipe(res);

    await Promise.all(
      product.files.map(async (file) => {
        const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');
        const response = await fetch(url);
        if (!response.ok || !response.body) return;
        const { Readable } = await import('stream');
        const nodeStream = Readable.fromWeb(response.body as any);
        zip.append(nodeStream, { name: file.fileName });
      }),
    );

    await zip.finalize();
  }

  async streamBundleZip(
    userId: string,
    productId: string,
    bundleId: string,
    res: Response,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    // Эзэмшил + хандалтын хугацаа (expiresAt) идэвхтэй эсэхийг шалгана.
    await this.assertActiveOwnership(userId, productId);

    const bundle = await this.prisma.productBundle.findUnique({
      where: { id: bundleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!bundle || bundle.productId !== productId) throw new NotFoundException('Bundle not found');

    const allFileIds = bundle.items.flatMap((item) =>
      item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
    );
    if (!allFileIds.length) throw new NotFoundException('No files in bundle');

    await this.bumpRealDownload(productId);
    await this.recordDownloads(userId, allFileIds);
    this.recordDownloadLog({
      productId,
      userId,
      fileName: `${bundle.title} (багц).zip`,
      source: 'bundle',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const files = await this.prisma.productFile.findMany({
      where: { id: { in: allFileIds } },
    });

    const zipName = `${bundle.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const zip = archiver.default('zip', { zlib: { level: 6 } });
    zip.pipe(res);

    for (const file of files) {
      const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');
      const response = await fetch(url);
      if (!response.ok || !response.body) continue;
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(response.body as any);
      zip.append(nodeStream, { name: file.fileName });
    }

    await zip.finalize();
  }

  // ── Async queue-based zip (production) ───────────────────────────────────

  private async assertOwned(userId: string, productId: string) {
    await this.assertActiveOwnership(userId, productId);
  }

  /**
   * Тухайн product-д хэрэглэгчид ИДЭВХТЭЙ (хугацаа дуусаагүй) хандах эрх байгаа
   * эсэхийг шалгана. Бүх PAID захиалгыг авч, аль нэг нь идэвхтэй (expiresAt
   * null=насан туршийн ЭСВЭЛ ирээдүйд) бол зөвшөөрнө.
   *   - PAID огт байхгүй → ForbiddenException('You do not own this product')
   *   - PAID байгаа ч БҮГД дууссан → ForbiddenException('Хандалтын хугацаа дууссан')
   */
  private async assertActiveOwnership(userId: string, productId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.PAID, items: { some: { productId } } },
      select: { id: true, expiresAt: true },
    });
    if (!orders.length) {
      throw new ForbiddenException('You do not own this product');
    }
    if (!pickActiveOrder(orders)) {
      throw new ForbiddenException('Хандалтын хугацаа дууссан');
    }
  }

  async enqueueProductZip(
    userId: string,
    productId: string,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    await this.assertOwned(userId, productId);
    await this.bumpRealDownload(productId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        files: { orderBy: { sortOrder: 'asc' } },
        bundles: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    this.recordDownloadLog({
      productId,
      userId,
      fileName: `${product.title} (бүх файл).zip`,
      source: 'paid',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    // flat файл + бүх bundle-ийн файлууд нэгтгэнэ (давхардал хасна)
    const flatFileIds = product.files.map((f) => f.id);
    const bundleFileIds = product.bundles.flatMap((b) =>
      b.items.flatMap((item) =>
        item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
      ),
    );
    const allFileIds = [...new Set([...flatFileIds, ...bundleFileIds])];
    if (!allFileIds.length) throw new NotFoundException('No files');

    // Татсан түүхэнд бүртгэнэ (admin popup-д харагдана)
    await this.recordDownloads(userId, allFileIds);

    // Кэшлэгдсэн zip — зөвхөн product сүүлд засагдсанаас ХОЙШ үүссэн бол ашиглана.
    // Эс бол admin файл нэмэх/устгахад хэрэглэгч хуучин (дутуу) zip татна.
    const cached = await this.prisma.zipJob.findFirst({
      where: { userId, productId, status: 'DONE', createdAt: { gte: product.updatedAt } },
      orderBy: { createdAt: 'desc' },
    });
    if (cached?.zipKey) {
      return { jobId: cached.id };
    }

    const job = await this.prisma.zipJob.create({
      data: { userId, productId, status: 'PENDING' },
    });

    const zipName = `${product.slug ?? productId}.zip`;
    await this.zipQueue.add(
      { jobId: job.id, userId, productId, fileIds: allFileIds, zipName },
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 },
    );

    return { jobId: job.id };
  }

  async enqueueBundleZip(
    userId: string,
    productId: string,
    bundleId: string,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    await this.assertOwned(userId, productId);
    await this.bumpRealDownload(productId);

    const bundle = await this.prisma.productBundle.findUnique({
      where: { id: bundleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!bundle || bundle.productId !== productId) throw new NotFoundException('Bundle not found');

    const allFileIds = bundle.items.flatMap((item) =>
      item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
    );
    if (!allFileIds.length) throw new NotFoundException('No files in bundle');

    this.recordDownloadLog({
      productId,
      userId,
      fileName: `${bundle.title} (багц).zip`,
      source: 'bundle',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    // Татсан түүхэнд бүртгэнэ (admin popup-д харагдана)
    await this.recordDownloads(userId, allFileIds);

    const job = await this.prisma.zipJob.create({
      data: { userId, status: 'PENDING' },
    });

    const zipName = `${bundle.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    await this.zipQueue.add(
      { jobId: job.id, userId, productId, bundleId, fileIds: allFileIds, zipName },
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 },
    );

    return { jobId: job.id };
  }

  async getZipJobStatus(userId: string, jobId: string) {
    const job = await this.prisma.zipJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) throw new NotFoundException('Job not found');

    if (job.status === 'DONE' && job.zipKey) {
      const url = await this.storage.getPresignedUrl(job.zipKey, 900, 'get');
      return { status: job.status, url };
    }

    return { status: job.status, error: job.error ?? undefined };
  }

  async getProductDownloadFileUrl(
    userId: string,
    productId: string,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    await this.assertOwned(userId, productId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        slug: true,
        title: true,
        downloadFileKey: true,
        files: { select: { id: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.downloadFileKey) throw new NotFoundException('No download file configured');

    await this.bumpRealDownload(productId);
    // "Бүгдийг татах" нэг zip — бүтээгдэхүүний бүх файлыг татсанд тооцож бүртгэнэ
    await this.recordDownloads(userId, product.files.map((f) => f.id));

    const url = await this.storage.getPresignedUrl(product.downloadFileKey, 900, 'get');
    const fileName = product.downloadFileKey.split('/').pop() ?? `${product.slug ?? productId}.zip`;
    this.recordDownloadLog({
      productId,
      userId,
      fileName,
      source: 'paid',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { url, fileName };
  }

  async getBundleDownloadFileUrl(
    userId: string,
    bundleId: string,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    const bundle = await this.prisma.productBundle.findUnique({
      where: { id: bundleId },
      select: { id: true, title: true, productId: true, downloadFileKey: true },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');

    await this.assertOwned(userId, bundle.productId);

    if (!bundle.downloadFileKey) throw new NotFoundException('No download file configured');

    await this.bumpRealDownload(bundle.productId);

    const url = await this.storage.getPresignedUrl(bundle.downloadFileKey, 900, 'get');
    const fileName = bundle.downloadFileKey.split('/').pop() ?? `${bundle.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    this.recordDownloadLog({
      productId: bundle.productId,
      userId,
      fileName,
      source: 'bundle',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { url, fileName };
  }

  // ─── ҮНЭГҮЙ бүтээгдэхүүний public download (auth-гүй) ──────────────────────
  // price = 0 (эсвэл null) бүтээгдэхүүнийг хэн ч (нэвтрээгүй ч) шууд татна.
  // Аюулгүй байдал: бүх public метод эхлээд assertFree-ээр price=0 эсэхийг
  // шалгана — үнэтэй бүтээгдэхүүн public-аар ХЭЗЭЭ Ч татагдахгүй (Forbidden).

  /** Бүтээгдэхүүн үнэгүй (price 0/null) эсэхийг шалгана. Үнэтэй бол Forbidden. */
  private async assertFree(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, price: true, published: true },
    });
    if (!product || !product.published) {
      throw new NotFoundException('Product not found');
    }
    if (product.price != null && Number(product.price) > 0) {
      throw new ForbiddenException('This product is not free');
    }
    return product;
  }

  /** Үнэгүй: ганц файлын signed URL (нэвтрэхгүй). fileId нь үнэгүй product-ийнх байх ёстой. */
  async freeFileUrl(
    productId: string,
    fileId: string,
    identifier?: string | null,
    meta?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) {
    await this.assertFree(productId);

    const file = await this.prisma.productFile.findUnique({
      where: { id: fileId },
      select: { id: true, fileName: true, fileKey: true, productId: true },
    });
    if (!file) throw new NotFoundException('File not found');

    // Файл нь тухайн үнэгүй product-ийнх ЭСВЭЛ түүний bundle-ийн файл мөн эсэх
    const belongs =
      file.productId === productId ||
      (await this.fileInProductBundles(productId, fileId));
    if (!belongs) throw new ForbiddenException('File does not belong to this product');

    await this.bumpRealDownload(productId, identifier);
    this.recordDownloadLog({
      productId,
      // Нэвтэрсэн байж болно (guest ч user). Байвал userId, эс бол null + ip.
      userId: meta?.userId ?? null,
      fileName: file.fileName,
      source: 'free',
      ip: meta?.ip ?? identifier,
      userAgent: meta?.userAgent,
    });
    // Нэвтэрсэн хэрэглэгч бол хэрэглэгчийн "Татсан" түүхэд (Download) ч бүртгэнэ —
    // эс бол үнэгүй татвал admin хэрэглэгч дэлгэцэд "Татсан: 0" буруу харагдана.
    await this.recordDownloads(meta?.userId, [file.id]);
    const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');
    return {
      fileId: file.id,
      fileName: file.fileName,
      url,
      expiresIn: 300,
    };
  }

  /** fileId нь productId-ийн аль нэг bundle-ийн fileIds-д багтсан эсэх */
  private async fileInProductBundles(productId: string, fileId: string): Promise<boolean> {
    const bundles = await this.prisma.productBundle.findMany({
      where: { productId },
      select: { items: { select: { fileId: true, fileIds: true } } },
    });
    for (const b of bundles) {
      for (const it of b.items) {
        if (it.fileId === fileId) return true;
        if ((it.fileIds ?? []).includes(fileId)) return true;
      }
    }
    return false;
  }

  /** Үнэгүй: бэлэн zip (downloadFileKey) шууд presign (нэвтрэхгүй). */
  async freeProductDownloadFileUrl(
    productId: string,
    identifier?: string | null,
    meta?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, slug: true, title: true, price: true, published: true, downloadFileKey: true,
        files: { select: { id: true } },
      },
    });
    if (!product || !product.published) throw new NotFoundException('Product not found');
    if (product.price != null && Number(product.price) > 0) {
      throw new ForbiddenException('This product is not free');
    }
    if (!product.downloadFileKey) throw new NotFoundException('No download file configured');

    await this.bumpRealDownload(productId, identifier);
    const url = await this.storage.getPresignedUrl(product.downloadFileKey, 900, 'get');
    const fileName = product.downloadFileKey.split('/').pop() ?? `${product.slug ?? productId}.zip`;
    this.recordDownloadLog({
      productId,
      userId: meta?.userId ?? null,
      fileName,
      source: 'free',
      ip: meta?.ip ?? identifier,
      userAgent: meta?.userAgent,
    });
    // Нэвтэрсэн хэрэглэгч бол product-ийн файлуудыг "Татсан" түүхэд (Download) бүртгэнэ.
    await this.recordDownloads(meta?.userId, product.files.map((f) => f.id));
    return { url, fileName };
  }

  /** Үнэгүй: бүх файлыг zip болгох queue (нэвтрэхгүй — userId-гүй job). */
  async enqueueFreeProductZip(
    productId: string,
    identifier?: string | null,
    meta?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) {
    await this.assertFree(productId);
    await this.bumpRealDownload(productId, identifier);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        files: { orderBy: { sortOrder: 'asc' } },
        bundles: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    this.recordDownloadLog({
      productId,
      userId: meta?.userId ?? null,
      fileName: `${product.title} (бүх файл).zip`,
      source: 'free',
      ip: meta?.ip ?? identifier,
      userAgent: meta?.userAgent,
    });

    const flatFileIds = product.files.map((f) => f.id);
    const bundleFileIds = product.bundles.flatMap((b) =>
      b.items.flatMap((item) =>
        item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
      ),
    );
    const allFileIds = [...new Set([...flatFileIds, ...bundleFileIds])];
    if (!allFileIds.length) throw new NotFoundException('No files');

    // Нэвтэрсэн хэрэглэгч бол бүх файлыг "Татсан" түүхэд (Download) бүртгэнэ.
    await this.recordDownloads(meta?.userId, allFileIds);

    // Үнэгүй product-ийн нийтийн zip кэш — зөвхөн product засагдсанаас ХОЙШ
    // үүссэн бол ашиглана (admin файл нэмэхэд хуучин дутуу zip татахаас сэргийлнэ).
    const cached = await this.prisma.zipJob.findFirst({
      where: { userId: null, productId, status: 'DONE', createdAt: { gte: product.updatedAt } },
      orderBy: { createdAt: 'desc' },
    });
    if (cached?.zipKey) return { jobId: cached.id };

    // ⚠️ СПАМ ХАМГААЛАЛТ: саяхан (5 мин дотор) үүссэн PENDING/PROCESSING job байвал
    // ШИНЭ job үүсгэхгүй, түүнийг л буцаана. Олон хүн зэрэг / бот спам дарахад
    // эхнийх боловсрогдож дуустал хэдэн арван давхар zip job үүсэхээс сэргийлнэ.
    const recentPending = await this.prisma.zipJob.findFirst({
      where: {
        userId: null,
        productId,
        status: { in: ['PENDING', 'PROCESSING'] },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentPending) return { jobId: recentPending.id };

    const job = await this.prisma.zipJob.create({
      data: { userId: null, productId, status: 'PENDING' },
    });

    const zipName = `${product.slug ?? productId}.zip`;
    await this.zipQueue.add(
      { jobId: job.id, userId: null, productId, fileIds: allFileIds, zipName },
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 },
    );
    return { jobId: job.id };
  }

  /** Үнэгүй zip job-ийн статус (нэвтрэхгүй — userId шалгахгүй, зөвхөн userId=null job). */
  async getFreeZipJobStatus(jobId: string) {
    const job = await this.prisma.zipJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== null) throw new NotFoundException('Job not found');
    if (job.status === 'DONE' && job.zipKey) {
      const url = await this.storage.getPresignedUrl(job.zipKey, 900, 'get');
      return { status: job.status, url };
    }
    return { status: job.status, error: job.error ?? undefined };
  }

  async listUserDownloads(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.PAID },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                downloadFileKey: true,
                accessType: true,
                accessDays: true,
                files: {
                  select: { id: true, fileName: true, sortOrder: true },
                  orderBy: { sortOrder: 'asc' },
                },
                bundles: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    downloadFileKey: true,
                    items: {
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        label: true,
                        fileId: true,
                        fileIds: true,
                      },
                    },
                  },
                },
                images: {
                  where: { videoUrl: null },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                  select: { fileKey: true },
                },
              },
            },
          },
        },
      },
    });

    // ── Bundle (cross-product) файлуудын нэрийг resolve хийх ──
    // BundleItem.fileId/fileIds нь ӨӨР product-ийн файл байж болно (cross-product).
    // Эдгээр файлын нэр энэ bundle product-ийн `files`-д байхгүй тул ProductFile-аас
    // тусад нь татаж нэрийн хамт буцаана (frontend жагсаалт + Бүх файлыг татах товчид хэрэгтэй).
    const allBundleFileIds = new Set<string>();
    for (const order of orders) {
      for (const item of order.items) {
        for (const bundle of ((item.product as any).bundles ?? [])) {
          for (const bi of (bundle.items ?? [])) {
            if (bi.fileId) allBundleFileIds.add(bi.fileId);
            for (const fid of (bi.fileIds ?? [])) allBundleFileIds.add(fid);
          }
        }
      }
    }

    const bundleFileMap = new Map<string, { id: string; fileName: string; sortOrder: number }>();
    if (allBundleFileIds.size > 0) {
      const resolved = await this.prisma.productFile.findMany({
        where: { id: { in: [...allBundleFileIds] } },
        select: { id: true, fileName: true, sortOrder: true },
      });
      for (const f of resolved) bundleFileMap.set(f.id, f);
    }

    const now = new Date();

    const rows = orders.flatMap((order) =>
      order.items.map((item) => {
        const { images, bundles, files, ...productRest } = item.product as any;

        // bundle items-д хамаарах fileIds цуглуул — эрэнхий файл жагсаалтаас хас
        const bundleFileIdSet = new Set<string>();
        for (const bundle of (bundles ?? [])) {
          for (const bi of (bundle.items ?? [])) {
            if (bi.fileId) bundleFileIdSet.add(bi.fileId);
            for (const fid of (bi.fileIds ?? [])) bundleFileIdSet.add(fid);
          }
        }

        const standaloneFiles = (files ?? []).filter(
          (f: { id: string }) => !bundleFileIdSet.has(f.id),
        );

        // bundle item-уудын дарааллыг хадгалж нэр бүхий файл жагсаалт үүсгэнэ
        const resolvedBundleFiles: { id: string; fileName: string; sortOrder: number }[] = [];
        const seen = new Set<string>();
        for (const bundle of (bundles ?? [])) {
          for (const bi of (bundle.items ?? [])) {
            const ids = (bi.fileIds && bi.fileIds.length > 0)
              ? bi.fileIds
              : (bi.fileId ? [bi.fileId] : []);
            for (const fid of ids) {
              if (seen.has(fid)) continue;
              const f = bundleFileMap.get(fid);
              if (f) {
                resolvedBundleFiles.push(f);
                seen.add(fid);
              }
            }
          }
        }

        const expiresAt = order.expiresAt ?? null;
        const isExpired = !!expiresAt && expiresAt <= now;

        return {
          orderId: order.id,
          purchasedAt: order.createdAt,
          // Хандалтын хугацаа — null бол насан туршийн, огноо бол түүнээс хойш дуусна.
          expiresAt,
          isExpired,
          product: {
            ...productRest, // accessType/accessDays багтсан (frontend trust badge/badge)
            files: standaloneFiles,
            bundleFiles: resolvedBundleFiles,
            bundles: bundles ?? [],
            thumbnailUrl: images?.[0]?.fileKey ? this.storage.getAssetUrl(images[0].fileKey) : null,
          },
        };
      }),
    );

    // ── Давхардал арилгах (нэг product = нэг мөр) ──
    // Нэг бүтээгдэхүүнийг дахин худалдсан/grant хийсэн бол олон захиалгад орж
    // болзошгүй. Хамгийн СОНГОМОЛ ИДЭВХТЭЙ эрхийг харуулна:
    //   1) Идэвхтэй (isExpired=false) мөр байвал тэдгээрээс хамгийн урт хүчинтэйг
    //      (expiresAt=null=насан туршийн хамгийн дээд) сонгоно.
    //   2) Идэвхтэй огт байхгүй бол хамгийн сүүлд дууссан (expiresAt хамгийн их)
    //      мөрийг isExpired=true-аар харуулна.
    const byProduct = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const pid = row.product.id as string;
      const prev = byProduct.get(pid);
      if (!prev) {
        byProduct.set(pid, row);
        continue;
      }
      byProduct.set(pid, this.pickBetterDownloadRow(prev, row));
    }

    return [...byProduct.values()];
  }

  /**
   * Нэг бүтээгдэхүүний 2 захиалгын мөрөөс "илүү сайн" (харуулах) нэгийг сонгоно.
   * Идэвхтэй > дууссан; хоёул идэвхтэй бол насан туршийн (expiresAt=null) эсвэл
   * хамгийн хожуу дуусах; хоёул дууссан бол хамгийн сүүлд дуусах.
   */
  private pickBetterDownloadRow<
    T extends { expiresAt: Date | null; isExpired: boolean },
  >(a: T, b: T): T {
    // Идэвхтэйг дууссанаас илүүд үзнэ.
    if (a.isExpired !== b.isExpired) return a.isExpired ? b : a;
    // Хоёул идэвхтэй: насан туршийн (null) хамгийн дээд, эс бол хожуу дуусахыг авна.
    if (!a.isExpired) {
      if (!a.expiresAt) return a;
      if (!b.expiresAt) return b;
      return b.expiresAt > a.expiresAt ? b : a;
    }
    // Хоёул дууссан: хамгийн сүүлд дууссанг (хамгийн их expiresAt) харуулна.
    if (!a.expiresAt) return a;
    if (!b.expiresAt) return b;
    return b.expiresAt > a.expiresAt ? b : a;
  }
}
