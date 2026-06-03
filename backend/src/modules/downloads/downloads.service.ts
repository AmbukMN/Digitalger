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

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(ZIP_QUEUE) private readonly zipQueue: Queue<ZipJobPayload>,
  ) {}

  // Бодит таталт тоолуурыг +1 (хэрэглэгч тухайн бүтээгдэхүүнийг бодитоор татах болгонд).
  // Зөвхөн admin-д харагдана; frontend-ийн "харагдах" downloadCount-д НӨЛӨӨЛӨХГҮЙ.
  // Алдаа гарвал татах урсгалыг таслахгүй (catch).
  private async bumpRealDownload(productId: string) {
    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: { realDownloadCount: { increment: 1 } },
      });
    } catch {
      /* тоолуурын алдаа татах урсгалд нөлөөлөхгүй */
    }
  }

  async verifyAndGetSignedUrl(userId: string, fileId: string) {
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
    const ownedDirect = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId: file.productId } },
      },
      select: { id: true },
    });

    let owned = !!ownedDirect;

    if (!owned) {
      // Хэрэглэгчийн эзэмшсэн бүх product-ийн bundle-уудаас энэ fileId-г хайна
      const ownedProductIds = (
        await this.prisma.orderItem.findMany({
          where: { order: { userId, status: OrderStatus.PAID } },
          select: { productId: true },
        })
      ).map((i) => i.productId);

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

    await this.prisma.download.create({
      data: { userId, fileId: file.id },
    });
    await this.bumpRealDownload(file.productId);

    const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');

    return {
      fileId: file.id,
      fileName: file.fileName,
      url,
      expiresIn: 300,
      generatedAt: Date.now(),
    };
  }

  async streamZipDownload(userId: string, productId: string, res: Response) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!product) throw new NotFoundException('Product not found');

    const owned = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId } },
      },
    });

    if (!owned) throw new ForbiddenException('You do not own this product');

    if (!product.files.length) throw new NotFoundException('No files to download');

    await this.bumpRealDownload(productId);

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

  async streamBundleZip(userId: string, productId: string, bundleId: string, res: Response) {
    const owned = await this.prisma.order.findFirst({
      where: { userId, status: OrderStatus.PAID, items: { some: { productId } } },
    });
    if (!owned) throw new ForbiddenException('You do not own this product');

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
    const owned = await this.prisma.order.findFirst({
      where: { userId, status: OrderStatus.PAID, items: { some: { productId } } },
    });
    if (!owned) throw new ForbiddenException('You do not own this product');
  }

  async enqueueProductZip(userId: string, productId: string) {
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

    // flat файл + бүх bundle-ийн файлууд нэгтгэнэ (давхардал хасна)
    const flatFileIds = product.files.map((f) => f.id);
    const bundleFileIds = product.bundles.flatMap((b) =>
      b.items.flatMap((item) =>
        item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
      ),
    );
    const allFileIds = [...new Set([...flatFileIds, ...bundleFileIds])];
    if (!allFileIds.length) throw new NotFoundException('No files');

    // Өмнө нь ижил бүтээгдэхүүнд амжилттай хийгдсэн zip байвал шууд буцаана
    const cached = await this.prisma.zipJob.findFirst({
      where: { userId, productId, status: 'DONE' },
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

  async enqueueBundleZip(userId: string, productId: string, bundleId: string) {
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

  async getProductDownloadFileUrl(userId: string, productId: string) {
    await this.assertOwned(userId, productId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true, downloadFileKey: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.downloadFileKey) throw new NotFoundException('No download file configured');

    await this.bumpRealDownload(productId);

    const url = await this.storage.getPresignedUrl(product.downloadFileKey, 900, 'get');
    const fileName = product.downloadFileKey.split('/').pop() ?? `${product.slug ?? productId}.zip`;
    return { url, fileName };
  }

  async getBundleDownloadFileUrl(userId: string, bundleId: string) {
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
  async freeFileUrl(productId: string, fileId: string) {
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

    await this.bumpRealDownload(productId);
    const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');
    return { fileId: file.id, fileName: file.fileName, url, expiresIn: 300 };
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
  async freeProductDownloadFileUrl(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true, price: true, published: true, downloadFileKey: true },
    });
    if (!product || !product.published) throw new NotFoundException('Product not found');
    if (product.price != null && Number(product.price) > 0) {
      throw new ForbiddenException('This product is not free');
    }
    if (!product.downloadFileKey) throw new NotFoundException('No download file configured');

    await this.bumpRealDownload(productId);
    const url = await this.storage.getPresignedUrl(product.downloadFileKey, 900, 'get');
    const fileName = product.downloadFileKey.split('/').pop() ?? `${product.slug ?? productId}.zip`;
    return { url, fileName };
  }

  /** Үнэгүй: бүх файлыг zip болгох queue (нэвтрэхгүй — userId-гүй job). */
  async enqueueFreeProductZip(productId: string) {
    await this.assertFree(productId);
    await this.bumpRealDownload(productId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        files: { orderBy: { sortOrder: 'asc' } },
        bundles: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const flatFileIds = product.files.map((f) => f.id);
    const bundleFileIds = product.bundles.flatMap((b) =>
      b.items.flatMap((item) =>
        item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
      ),
    );
    const allFileIds = [...new Set([...flatFileIds, ...bundleFileIds])];
    if (!allFileIds.length) throw new NotFoundException('No files');

    // Үнэгүй product-ийн нийтийн zip кэш (userId null) байвал дахин ашиглана
    const cached = await this.prisma.zipJob.findFirst({
      where: { userId: null, productId, status: 'DONE' },
      orderBy: { createdAt: 'desc' },
    });
    if (cached?.zipKey) return { jobId: cached.id };

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

    return orders.flatMap((order) =>
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

        return {
          orderId: order.id,
          purchasedAt: order.createdAt,
          product: {
            ...productRest,
            files: standaloneFiles,
            bundleFiles: resolvedBundleFiles,
            bundles: bundles ?? [],
            thumbnailUrl: images?.[0]?.fileKey ? this.storage.getAssetUrl(images[0].fileKey) : null,
          },
        };
      }),
    );
  }
}
