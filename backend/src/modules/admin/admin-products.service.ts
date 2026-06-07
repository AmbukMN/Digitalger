import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CloudflareStreamService } from '../../storage/cloudflare-stream.service';
import { N8nService } from '../n8n/n8n.service';
import { EmailService } from '../notifications/email.service';
import { expandQuery } from '../../common/transliterate';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly stream: CloudflareStreamService,
    private readonly n8n: N8nService,
    private readonly email: EmailService,
  ) {}

  async findAll(query: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const terms = query.search ? expandQuery(query.search) : [];
    const where: Prisma.ProductWhereInput = terms.length
      ? {
          OR: terms.flatMap((term) => [
            { title:         { contains: term, mode: 'insensitive' } },
            { slug:          { contains: term, mode: 'insensitive' } },
            { description:   { contains: term, mode: 'insensitive' } },
            { whatsIncluded: { contains: term, mode: 'insensitive' } },
            { category: { name: { contains: term, mode: 'insensitive' } } },
            {
              bundles: {
                some: {
                  OR: [
                    { title:       { contains: term, mode: 'insensitive' } },
                    { description: { contains: term, mode: 'insensitive' } },
                    {
                      items: {
                        some: {
                          OR: [
                            { name:        { contains: term, mode: 'insensitive' } },
                            { description: { contains: term, mode: 'insensitive' } },
                            { label:       { contains: term, mode: 'insensitive' } },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          ]),
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { orderItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        ...p,
        thumbnailUrl: p.images[0]
          ? this.storage.getAssetUrl(p.images[0].fileKey)
          : (p.previewUrl ?? null),
      })),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        files: true,
        course: { include: { lessons: true } },
        bundles: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(dto: CreateProductDto) {
    const slugExists = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });

    if (slugExists) {
      throw new ConflictException('Product slug already exists');
    }

    const { compareAtPrice, discountEndsAt, howToUseSteps, categoryIds, categoryId, ...rest } = dto;
    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : categoryId;

    // Устсан/буруу category id үед FK алдаа (500)-аас сэргийлж зөвхөн БОДИТ үлдээнэ.
    const validIds = await this.filterExistingCategoryIds(
      categoryIds && categoryIds.length > 0 ? categoryIds : primaryCategoryId ? [primaryCategoryId] : [],
    );

    return this.prisma.product.create({
      data: {
        ...rest,
        categoryId: validIds[0] ?? null,
        categoryIds: validIds,
        // price null/undefined бол 0 (үнэгүй бүтээгдэхүүн) — Decimal(null) алдаа гаргадаг
        price: new Prisma.Decimal(dto.price ?? 0),
        ...(compareAtPrice !== undefined && {
          compareAtPrice:
            compareAtPrice === null ? null : new Prisma.Decimal(compareAtPrice),
        }),
        ...(discountEndsAt !== undefined && {
          discountEndsAt: discountEndsAt ? new Date(discountEndsAt) : null,
        }),
        ...(howToUseSteps !== undefined && {
          howToUseSteps: JSON.parse(JSON.stringify(howToUseSteps)),
        }),
      },
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.ensureProductExists(id);

    if (dto.slug) {
      const conflict = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException('Product slug already exists');
      }
    }

    const { price, compareAtPrice, discountEndsAt, howToUseSteps, categoryIds, categoryId: dtoCategoryId, ...rest } = dto;
    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : dtoCategoryId;

    // Устсан/буруу category id үед FK алдаа (500)-аас сэргийлж зөвхөн БОДИТ
    // байгаа category id-г үлдээнэ (байхгүйг шүүнэ).
    const validIds = await this.filterExistingCategoryIds(
      categoryIds !== undefined ? categoryIds : primaryCategoryId ? [primaryCategoryId] : [],
    );
    const safePrimaryId = validIds[0] ?? null;

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(primaryCategoryId !== undefined && { categoryId: safePrimaryId }),
        ...(categoryIds !== undefined && { categoryIds: validIds }),
        ...(price !== undefined && { price: new Prisma.Decimal(price) }),
        ...(compareAtPrice !== undefined && {
          compareAtPrice: compareAtPrice === null ? null : new Prisma.Decimal(compareAtPrice),
        }),
        ...(discountEndsAt !== undefined && {
          discountEndsAt: discountEndsAt ? new Date(discountEndsAt) : null,
        }),
        ...(howToUseSteps !== undefined && {
          howToUseSteps: JSON.parse(JSON.stringify(howToUseSteps)),
        }),
      },
      include: { category: true, images: true },
    });

    // published: false → true болсон үед n8n-д мэдэгдэл (Telegram)
    if (!existing.published && updated.published) {
      this.n8n.emitProductPublished({
        productId: updated.id,
        title: updated.title,
        slug: updated.slug,
        price: Number(updated.price),
        categoryName: (updated.category as any)?.name ?? null,
        publishedAt: new Date().toISOString(),
      }).catch(() => null);

      // Бүх ACTIVE subscriber-т "шинэ бүтээгдэхүүн" имэйл (зөвхөн НЭГ удаа).
      // notifiedAt=null үед л явуулна (давхар явуулахгүй).
      // Fire-and-forget — имэйл алдвал publish-д нөлөөлөхгүй.
      if (!existing.notifiedAt) {
        void this.notifySubscribersNewProduct(updated);
      }
    }

    return updated;
  }

  async remove(id: string) {
    await this.ensureProductExists(id);

    // HARD DELETE — захиалгатай ч бай шууд бүрэн устгана. Устгасан бүтээгдэхүүн
    // хэрэглэгчийн "Миний сан"-д огт харагдахгүй (бүтээгдэхүүн байхгүй болно).
    //
    // OrderItem.product relation нь onDelete: Restrict тул эхлээд тухайн
    // бүтээгдэхүүний OrderItem-уудыг устгана. Хэрэв энэ нь захиалгын ЦОР ГАНЦ
    // зүйл байсан бол захиалга хоосон үлдэхээс сэргийлж тухайн Order-ийг ч
    // устгана (хоосон болсон захиалгууд). Бусад зүйл (файл/зураг/курс/bundle/
    // FAQ/wishlist) нь onDelete: Cascade-аар product устгах үед автоматаар арилна.
    return this.prisma.$transaction(async (tx) => {
      // Энэ бүтээгдэхүүнийг агуулсан захиалгуудын ID-г цуглуул
      const items = await tx.orderItem.findMany({
        where: { productId: id },
        select: { orderId: true },
      });
      const orderIds = [...new Set(items.map((i) => i.orderId))];

      // Энэ бүтээгдэхүүний бүх OrderItem устгана
      await tx.orderItem.deleteMany({ where: { productId: id } });

      // Хоосон болсон (өөр item-гүй) захиалгуудыг устгана — Payment/Coupon г.м.
      // нь Order onDelete: Cascade-аар арилна.
      if (orderIds.length) {
        const empties = await tx.order.findMany({
          where: { id: { in: orderIds }, items: { none: {} } },
          select: { id: true },
        });
        if (empties.length) {
          await tx.order.deleteMany({ where: { id: { in: empties.map((o) => o.id) } } });
        }
      }

      // Бүтээгдэхүүнийг устгана (бусад холбоотой зүйл cascade-аар арилна)
      return tx.product.delete({ where: { id } });
    });
  }

  async listImages(productId: string) {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    return images.map((img) => {
      const variantMap: Record<string, string> = {};
      for (const v of img.variants) {
        variantMap[v.size] = this.storage.getAssetUrl(v.fileKey);
      }
      return {
        ...img,
        url: img.videoUrl ? '' : this.storage.getAssetUrl(img.fileKey),
        variants: img.variants.length > 0 ? variantMap : undefined,
      };
    });
  }

  async listFiles(productId: string) {
    return this.prisma.productFile.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Modules ────────────────────────────────────────────────────────────────

  private async ensureCourse(productId: string) {
    return this.prisma.course.upsert({
      where: { productId },
      create: { productId },
      update: {},
    });
  }

  async listModules(productId: string) {
    const course = await this.prisma.course.findUnique({
      where: { productId },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: { lessons: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    return course?.modules ?? [];
  }

  async createModule(productId: string, dto: { title: string; sortOrder?: number }) {
    const course = await this.ensureCourse(productId);
    const count = await this.prisma.courseModule.count({ where: { courseId: course.id } });
    return this.prisma.courseModule.create({
      data: { courseId: course.id, title: dto.title, sortOrder: dto.sortOrder ?? count },
      include: { lessons: true },
    });
  }

  async updateModule(moduleId: string, dto: Partial<{ title: string; sortOrder: number }>) {
    return this.prisma.courseModule.update({ where: { id: moduleId }, data: dto });
  }

  async deleteModule(moduleId: string) {
    // Unassign lessons first, then delete module
    await this.prisma.lesson.updateMany({ where: { moduleId }, data: { moduleId: null } });
    return this.prisma.courseModule.delete({ where: { id: moduleId } });
  }

  async reorderModules(items: { id: string; sortOrder: number }[]) {
    await Promise.all(
      items.map((item) => this.prisma.courseModule.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })),
    );
    return { success: true };
  }

  // ── Lessons ─────────────────────────────────────────────────────────────────

  async listLessons(productId: string) {
    const course = await this.prisma.course.findUnique({
      where: { productId },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    return course?.lessons ?? [];
  }

  /**
   * Browser→Cloudflare Stream шууд upload хийх нэг удаагийн URL үүсгэнэ.
   * Admin хичээлийн видео нэмэхэд том файлыг backend-ээр дамжуулахгүй шууд Stream рүү.
   * @returns { uploadURL, uid } — uid-г дараа нь Lesson.videoStreamId-д хадгална.
   */
  async createStreamUpload(opts: { name?: string; maxDurationSeconds?: number }) {
    if (!this.stream.configured) {
      throw new BadRequestException('Cloudflare Stream тохируулаагүй байна');
    }
    try {
      return await this.stream.createDirectUpload({
        name: opts.name,
        maxDurationSeconds: opts.maxDurationSeconds,
      });
    } catch {
      throw new BadRequestException('Stream upload URL үүсгэж чадсангүй');
    }
  }

  /**
   * Stream видеоны боловсруулалтын төлөв. Upload дууссаны дараа ready болсон эсэхийг шалгана.
   * @returns { status, durationSec, thumbnail, ready }
   */
  async getStreamStatus(uid: string) {
    if (!this.stream.configured) {
      throw new BadRequestException('Cloudflare Stream тохируулаагүй байна');
    }
    try {
      return await this.stream.getVideoStatus(uid);
    } catch {
      throw new BadRequestException('Stream видеоны төлөв авч чадсангүй');
    }
  }

  async createLesson(productId: string, dto: CreateLessonDto) {
    const course = await this.ensureCourse(productId);
    const count = await this.prisma.lesson.count({ where: { courseId: course.id } });
    // Видео эх сурвалж 3 хувилбар — зэрэг ОРОХГҮЙ (mutually exclusive).
    // Давуу эрэмбэ: videoStreamId → videoKey → videoUrl.
    const source = this.resolveVideoSource(dto);
    return this.prisma.lesson.create({
      data: {
        courseId: course.id,
        moduleId: dto.moduleId ?? null,
        title: dto.title,
        description: dto.description,
        videoStreamId: source.videoStreamId,
        videoKey: source.videoKey,
        videoUrl: source.videoUrl,
        ...(dto.streamStatus !== undefined && { streamStatus: dto.streamStatus }),
        durationSec: dto.durationSec,
        isFreePreview: dto.isFreePreview ?? false,
        sortOrder: dto.sortOrder ?? count,
      },
    });
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const data: Record<string, unknown> = { ...dto };
    // Видео эх сурвалжийн аль нэг өгөгдсөн бол бусдыг null болгож mutually exclusive байлгана.
    if (dto.videoStreamId !== undefined && dto.videoStreamId) {
      data.videoStreamId = dto.videoStreamId;
      data.videoKey = null;
      data.videoUrl = null;
    } else if (dto.videoKey !== undefined && dto.videoKey) {
      data.videoKey = dto.videoKey;
      data.videoStreamId = null;
      data.videoUrl = null;
    } else if (dto.videoUrl !== undefined && dto.videoUrl) {
      data.videoUrl = dto.videoUrl;
      data.videoStreamId = null;
      data.videoKey = null;
    }
    return this.prisma.lesson.update({ where: { id: lessonId }, data });
  }

  async deleteLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { videoStreamId: true },
    });
    const deleted = await this.prisma.lesson.delete({ where: { id: lessonId } });
    // Stream видеотой бол Cloudflare-аас ч устгана (fire-and-forget, алдвал хайхрахгүй).
    if (lesson?.videoStreamId) {
      void this.stream.deleteVideo(lesson.videoStreamId).catch(() => null);
    }
    return deleted;
  }

  /**
   * Видео эх сурвалжийн 3 хувилбараас зөвхөн НЭГийг сонгож бусдыг null болгоно.
   * Давуу эрэмбэ: videoStreamId → videoKey → videoUrl.
   */
  private resolveVideoSource(dto: { videoStreamId?: string; videoKey?: string; videoUrl?: string }): {
    videoStreamId: string | null;
    videoKey: string | null;
    videoUrl: string | null;
  } {
    if (dto.videoStreamId) {
      return { videoStreamId: dto.videoStreamId, videoKey: null, videoUrl: null };
    }
    if (dto.videoKey) {
      return { videoStreamId: null, videoKey: dto.videoKey, videoUrl: null };
    }
    return { videoStreamId: null, videoKey: null, videoUrl: dto.videoUrl ?? null };
  }

  async reorderLessons(items: { id: string; sortOrder: number }[]) {
    await Promise.all(
      items.map((item) => this.prisma.lesson.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })),
    );
    return { success: true };
  }

  async clone(id: string) {
    const source = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        files: { orderBy: { sortOrder: 'asc' } },
        bundles: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
        faqs: { select: { faqId: true } },
        testimonials: { select: { testimonialId: true } },
      },
    });

    if (!source) throw new NotFoundException('Product not found');

    const baseSlug = `${source.slug}-copy`;
    let slug = baseSlug;
    let attempt = 0;
    while (await this.prisma.product.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const { id: _id, slug: _slug, createdAt: _ca, updatedAt: _ua, images, files, bundles, faqs, testimonials, howToUseSteps, ...rest } = source;

    const cloned = await this.prisma.product.create({
      data: {
        ...rest,
        howToUseSteps: howToUseSteps ?? undefined,
        slug,
        published: false,
        title: `${source.title} (копи)`,
        images: {
          create: images.map(({ fileKey, videoUrl, alt, isPrimary, sortOrder }) => ({ fileKey, videoUrl, alt, isPrimary, sortOrder })),
        },
        files: {
          create: files.map(({ fileKey, fileName, mimeType, sizeBytes, sortOrder }) => ({ fileKey, fileName, mimeType, sizeBytes, sortOrder })),
        },
        bundles: {
          create: bundles.map((b) => ({
            title: b.title,
            description: b.description,
            sortOrder: b.sortOrder,
            items: {
              create: b.items.map(({ name, description, label, fileId, fileIds, sortOrder: so }) => ({
                name, description, label, fileId, fileIds, sortOrder: so,
              })),
            },
          })),
        },
      },
      include: { category: true, images: true },
    });

    if (faqs.length > 0) {
      await this.prisma.productFAQ.createMany({
        data: faqs.map(({ faqId }) => ({ productId: cloned.id, faqId })),
        skipDuplicates: true,
      });
    }
    if (testimonials.length > 0) {
      await this.prisma.productTestimonial.createMany({
        data: testimonials.map(({ testimonialId }) => ({ productId: cloned.id, testimonialId })),
        skipDuplicates: true,
      });
    }

    return cloned;
  }

  /**
   * Шинэ бүтээгдэхүүн нийтлэгдэхэд бүх ACTIVE subscriber-т имэйл явуулна.
   * - notifiedAt-г одоо болгож тэмдэглэнэ (давхар явуулахгүй).
   * - Маш олон subscriber байж болзошгүй тул fire-and-forget; EmailService-ийн
   *   дотоод queue (300ms rate limit) дараалуулж явуулна.
   * - Аливаа алдаа publish-д нөлөөлөхгүй (бүхэлд нь try/catch).
   */
  private async notifySubscribersNewProduct(product: {
    id: string;
    title: string;
    slug: string;
    price: Prisma.Decimal;
    images?: { fileKey: string; videoUrl: string | null }[];
  }) {
    try {
      // Давхар явуулахаас сэргийлж нэн даруй тэмдэглэнэ (race-аас хамгаалах).
      const marked = await this.prisma.product.updateMany({
        where: { id: product.id, notifiedAt: null },
        data: { notifiedAt: new Date() },
      });
      // Өөр процесс аль хэдийн тэмдэглэсэн бол давтан явуулахгүй.
      if (marked.count === 0) return;

      const subscribers = await this.prisma.subscriber.findMany({
        where: { status: 'ACTIVE' },
        select: { email: true },
      });
      if (subscribers.length === 0) return;

      // Primary зураг (видео биш) → R2 public url.
      const primary = product.images?.find((img) => !img.videoUrl && img.fileKey);
      const imageUrl = primary ? this.storage.getAssetUrl(primary.fileKey) : null;

      const price = Number(product.price);

      for (const sub of subscribers) {
        // sendNewProduct дотроо queue-д enqueue хийдэг тул await хийхгүй —
        // зүгээр enqueue болгож цааш үргэлжилнэ.
        this.email
          .sendNewProduct({
            to: sub.email,
            productTitle: product.title,
            productSlug: product.slug,
            price,
            salePrice: null,
            imageUrl,
          })
          .catch(() => null);
      }
    } catch {
      // notify алдвал publish-д нөлөөлөхгүй.
    }
  }

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /**
   * Зөвхөн БОДИТ байгаа category id-г үлдээж (устсаныг шүүж) дарааллыг хадгална.
   * Устсан категорийн id-г product-д хадгалбал FK constraint алдаа (500) гардаг.
   */
  private async filterExistingCategoryIds(ids: (string | undefined | null)[]): Promise<string[]> {
    const clean = [...new Set(ids.filter((x): x is string => !!x))];
    if (clean.length === 0) return [];
    const found = await this.prisma.category.findMany({
      where: { id: { in: clean } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((c) => c.id));
    return clean.filter((id) => foundSet.has(id)); // оруулсан дарааллыг хадгална
  }
}
