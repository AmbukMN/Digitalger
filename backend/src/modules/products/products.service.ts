import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { expandQuery } from '../../common/transliterate';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly cache: AppCacheService,
  ) {}

  private mapProduct<T extends {
    previewUrl?: string | null;
    images?: {
      fileKey: string;
      videoUrl?: string | null;
      alt: string | null;
      isPrimary: boolean;
      sortOrder: number;
      variants?: { size: string; fileKey: string }[];
    }[];
  }>(product: T) {
    const primary =
      product.images?.find((i) => i.isPrimary && !i.videoUrl) ??
      product.images?.filter((i) => !i.videoUrl).sort((a, b) => a.sortOrder - b.sortOrder)[0];

    // variant байвал thumbnail variant ашиглана, эс бөгөөс оригинал key
    const thumbVariant = primary?.variants?.find((v) => v.size === 'thumbnail');
    const thumbnailUrl = primary
      ? this.storage.getAssetUrl(thumbVariant?.fileKey ?? primary.fileKey)
      : (product.previewUrl ?? null);

    const mainVideoUrl = product.images?.find((i) => i.videoUrl)?.videoUrl ?? null;
    const course = (product as any).course;
    const lessonCount: number | null = course?._count?.lessons ?? null;

    return {
      ...product,
      thumbnailUrl,
      mainVideoUrl,
      lessonCount,
      images: product.images?.map((img) => {
        const variantMap: Record<string, string> = {};
        for (const v of img.variants ?? []) {
          variantMap[v.size] = this.storage.getAssetUrl(v.fileKey);
        }
        return {
          ...img,
          url: img.videoUrl ? '' : this.storage.getAssetUrl(img.fileKey),
          variants: Object.keys(variantMap).length > 0 ? variantMap : undefined,
        };
      }),
    };
  }

  async findPublished(
    query: {
      page?: number;
      pageSize?: number;
      categorySlug?: string;
      featured?: boolean;
      type?: string;
      types?: string[];
      sortBy?: 'newest' | 'discount' | 'rating' | 'downloads';
      onSale?: boolean;
    },
    isAdmin?: boolean,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 12));

    // Homepage / жагсаалтын эхний 2 хуудсыг 5 мин cache (хамгийн их хандалттай).
    // 3+ дахь хуудас, ховор тохиолдлуудыг шууд DB-ээс уншина (cache key тэсрэхээс
    // сэргийлж). Admin product өөрчлөгдөхөд бүх products:list:* invalidate болно.
    // ⚠️ Admin (isAdmin=true) бол adminOnly product-уудыг ч хардаг тул public
    // cache-тэй холилдохгүйн тулд cache БҮРЭН алгасаж шууд DB-ээс уншина
    // (admin цөөн хүсэлттэй — ачаалал үл нэмэгдэнэ).
    if (page <= 2 && isAdmin !== true) {
      const key =
        CacheKeys.productListPrefix +
        JSON.stringify({
          p: page,
          ps: pageSize,
          c: query.categorySlug ?? '',
          f: query.featured ?? '',
          t: (query.types ?? []).slice().sort(),
          s: query.sortBy ?? 'newest',
          o: query.onSale ?? false,
        });
      return this.cache.getOrSet(key, 5 * 60_000, () =>
        this.computeFindPublished(query, page, pageSize, isAdmin),
      );
    }

    return this.computeFindPublished(query, page, pageSize, isAdmin);
  }

  private async computeFindPublished(
    query: {
      categorySlug?: string;
      featured?: boolean;
      types?: string[];
      sortBy?: 'newest' | 'discount' | 'rating' | 'downloads';
      onSale?: boolean;
    },
    page: number,
    pageSize: number,
    isAdmin?: boolean,
  ) {
    const skip = (page - 1) * pageSize;

    // Категори шүүлт: product тухайн категорид categoryId (primary) ЭСВЭЛ
    // categoryIds (олон категори array)-ийн алинд нь байвал гаргана. Зөвхөн
    // category relation (categoryId)-аар шүүвэл олон категоритой product алга болдог.
    let categoryFilter: Prisma.ProductWhereInput | undefined;
    if (query.categorySlug) {
      const cat = await this.prisma.category.findUnique({
        where: { slug: query.categorySlug },
        select: { id: true },
      });
      // Олдохгүй слаг → үр дүн хоосон (буруу id-аар шүүж 0 буцаана)
      const catId = cat?.id ?? '__none__';
      categoryFilter = { OR: [{ categoryId: catId }, { categoryIds: { has: catId } }] };
    }

    const where: Prisma.ProductWhereInput = {
      published: true,
      // ⚠️ Admin биш бол adminOnly бүтээгдэхүүн нуугдана. Admin (isAdmin=true)
      // бол бүгд (adminOnly=true ч) харагдана.
      ...(isAdmin !== true && { adminOnly: false }),
      ...(query.featured !== undefined && { featured: query.featured }),
      ...(categoryFilter ?? {}),
      ...(query.types && query.types.length > 0 && { type: { in: query.types as any[] } }),
      ...(query.onSale && { compareAtPrice: { not: null } }),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sortBy === 'rating'    ? { rating: 'desc' } :
      query.sortBy === 'downloads' ? { downloadCount: 'desc' } :
      query.sortBy === 'discount'  ? { compareAtPrice: 'desc' } :
      { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' }, include: { variants: { select: { size: true, fileKey: true } } } },
          course: { select: { _count: { select: { lessons: true } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => this.mapProduct(p)),
      total,
      page,
      pageSize,
    };
  }

  // Үзэлт +1 — frontend client-side (нэг л удаа) дуудна. Fire-and-forget,
  // унавал чимээгүй (хариу буцаахад нөлөөлөхгүй).
  async incrementView(slug: string, isAdmin?: boolean) {
    await this.prisma.product
      .updateMany({
        where: { slug, published: true, ...(isAdmin !== true && { adminOnly: false }) },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});
    return { ok: true };
  }

  async findBySlug(slug: string, isAdmin?: boolean) {
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true, ...(isAdmin !== true && { adminOnly: false }) },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        files: { orderBy: { sortOrder: 'asc' }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, sortOrder: true } },
        course: {
          include: {
            modules: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, description: true, durationSec: true, sortOrder: true, videoKey: true, videoUrl: true, isFreePreview: true, moduleId: true } },
              },
            },
            // Only ungrouped lessons (no module)
            lessons: { where: { moduleId: null }, orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, description: true, durationSec: true, sortOrder: true, videoKey: true, videoUrl: true, isFreePreview: true, moduleId: true } },
          },
        },
        reviews: {
          take: 10, // эхний хуудас 10 (frontend pagination 10/хуудас)
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        faqs: {
          include: { faq: true },
          orderBy: { sortOrder: 'asc' },
        },
        testimonials: {
          include: { testimonial: true },
        },
        bundles: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, name: true, description: true, label: true, fileId: true, fileIds: true, sortOrder: true, bundleId: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Flatten junction tables for frontend consumption
    const mapped = this.mapProduct(product);

    // Resolve video URLs for free preview lessons (R2 keys → presigned URLs)
    const resolveLesson = async (lesson: any) => {
      if (lesson.isFreePreview && lesson.videoKey && !lesson.videoUrl) {
        const url = await this.storage.getPresignedUrl(lesson.videoKey, 7200, 'get').catch(() => null);
        return { ...lesson, videoUrl: url, videoKey: null };
      }
      return { ...lesson, videoKey: null };
    };

    let course = mapped.course;
    if (course) {
      const resolvedLessons = course.lessons ? await Promise.all(course.lessons.map(resolveLesson)) : [];
      const resolvedModules = course.modules
        ? await Promise.all(
            course.modules.map(async (mod: any) => ({
              ...mod,
              lessons: await Promise.all((mod.lessons ?? []).map(resolveLesson)),
            })),
          )
        : [];
      course = { ...course, lessons: resolvedLessons, modules: resolvedModules };
    }

    // Trust badge dynamic: видео курс бол "Шууд үзэх", эс бол "Шууд татах".
    // hasCourse — энэ product курс мөн эсэх (course != null).
    const hasCourse = !!course;

    return {
      ...mapped, // accessType/accessDays багтсан (findFirst бүх scalar буцаана)
      course,
      hasCourse,
      isVideoCourse: hasCourse,
      faqs: product.faqs.map((pf) => pf.faq),
      testimonials: product.testimonials.map((pt) => pt.testimonial),
    };
  }

  async search(q: string, page = 1, pageSize = 12, isAdmin?: boolean) {
    const skip = (Math.max(1, page) - 1) * Math.min(48, pageSize);

    // Build expanded terms: original + cross-script transliteration
    const terms = expandQuery(q);
    if (!terms.length) return { items: [], total: 0, page, pageSize };

    // Build OR clauses for every term across all searchable fields
    const termClauses = (term: string): Prisma.ProductWhereInput[] => [
      { title:         { contains: term, mode: 'insensitive' } },
      { description:   { contains: term, mode: 'insensitive' } },
      { whatsIncluded: { contains: term, mode: 'insensitive' } },
      { howToUse:      { contains: term, mode: 'insensitive' } },
      { seoTitle:      { contains: term, mode: 'insensitive' } },
      { category: { name: { contains: term, mode: 'insensitive' } } },
      // Bundle sections (group titles + descriptions)
      {
        bundles: {
          some: {
            OR: [
              { title:       { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
              // Bundle items (individual file names)
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
    ];

    const where: Prisma.ProductWhereInput = {
      published: true,
      // Admin биш бол adminOnly бүтээгдэхүүн хайлтаас нуугдана.
      ...(isAdmin !== true && { adminOnly: false }),
      OR: terms.flatMap(termClauses),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' }, include: { variants: { select: { size: true, fileKey: true } } } },
          course: { select: { _count: { select: { lessons: true } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => this.mapProduct(p)),
      total,
      page,
      pageSize,
    };
  }

  async findSuggested(slug: string, count = 8, isAdmin?: boolean) {
    // Suggested products ховор өөрчлөгддөг ч product detail бүрд уншигддаг,
    // муу тохиолдолд 4 дараалсан query ажилладаг. 10 мин cache → DB ачаалал бараг тэг.
    // ⚠️ Admin (isAdmin=true) adminOnly product-уудыг ч хардаг тул public cache-тэй
    // холилдохгүйн тулд cache БҮРЭН алгасаж шууд тооцоолно (admin цөөн хүсэлттэй).
    if (isAdmin === true) {
      return this.computeSuggested(slug, count, isAdmin);
    }
    return this.cache.getOrSet(`suggested:${slug}:${count}`, 10 * 60_000, () =>
      this.computeSuggested(slug, count, isAdmin),
    );
  }

  private async computeSuggested(slug: string, count: number, isAdmin?: boolean) {
    // Admin биш бол adminOnly бүтээгдэхүүн санал болгох жагсаалтаас нуугдана.
    const adminOnlyFilter = isAdmin !== true ? { adminOnly: false } : {};
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true, ...adminOnlyFilter },
      select: { id: true, categoryId: true, type: true },
    });
    if (!product) return [];

    const include = {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
      course: { select: { _count: { select: { lessons: true } } } },
    };

    // 1st priority: same category + same type
    let items = await this.prisma.product.findMany({
      where: { published: true, ...adminOnlyFilter, id: { not: product.id }, categoryId: product.categoryId ?? undefined, type: product.type },
      take: count,
      orderBy: { rating: 'desc' },
      include,
    });

    // 2nd priority: same category, any type
    if (items.length < count && product.categoryId) {
      const existingIds = new Set([product.id, ...items.map((i) => i.id)]);
      const extra = await this.prisma.product.findMany({
        where: { published: true, ...adminOnlyFilter, id: { notIn: [...existingIds] }, categoryId: product.categoryId },
        take: count - items.length,
        orderBy: { rating: 'desc' },
        include,
      });
      items = [...items, ...extra];
    }

    // 3rd priority: same type, any category
    if (items.length < count) {
      const existingIds = new Set([product.id, ...items.map((i) => i.id)]);
      const extra = await this.prisma.product.findMany({
        where: { published: true, ...adminOnlyFilter, id: { notIn: [...existingIds] }, type: product.type },
        take: count - items.length,
        orderBy: { rating: 'desc' },
        include,
      });
      items = [...items, ...extra];
    }

    // 4th priority: any product
    if (items.length < count) {
      const existingIds = new Set([product.id, ...items.map((i) => i.id)]);
      const extra = await this.prisma.product.findMany({
        where: { published: true, ...adminOnlyFilter, id: { notIn: [...existingIds] } },
        take: count - items.length,
        orderBy: { rating: 'desc' },
        include,
      });
      items = [...items, ...extra];
    }

    return items.map((p) => this.mapProduct(p));
  }

  async findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        files: true,
      },
    });
  }

  /**
   * Public product list / suggested cache-г бөөнөөр устгана. Admin product
   * create/update/delete/clone хийх бүрд дуудна (хуучин жагсаалт харагдахаас
   * сэргийлнэ). Fail-open — cache устгаж чадаагүй ч TTL дээр түшиглэнэ.
   */
  async invalidateListCache(): Promise<void> {
    await this.cache.delByPrefix(CacheKeys.productListPrefix, 'suggested:');
    // Product-ийн категори/published өөрчлөгдвөл категори тус бүрийн product count
    // хуучирна — категорийн жагсаалтын cache-г ч цэвэрлэнэ.
    await this.cache.del(CacheKeys.categories);
  }
}
