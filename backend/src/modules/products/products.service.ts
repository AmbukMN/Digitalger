import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { expandQuery } from '../../common/transliterate';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private mapProduct<T extends { previewUrl?: string | null; images?: { fileKey: string; videoUrl?: string | null; alt: string | null; isPrimary: boolean; sortOrder: number }[] }>(
    product: T,
  ) {
    const primary =
      product.images?.find((i) => i.isPrimary && !i.videoUrl) ??
      product.images?.filter((i) => !i.videoUrl).sort((a, b) => a.sortOrder - b.sortOrder)[0];

    const thumbnailUrl = primary
      ? this.storage.getAssetUrl(primary.fileKey)
      : (product.previewUrl ?? null);

    const mainVideoUrl = product.images?.find((i) => i.videoUrl)?.videoUrl ?? null;
    const course = (product as any).course;
    const lessonCount: number | null = course?._count?.lessons ?? null;

    return {
      ...product,
      thumbnailUrl,
      mainVideoUrl,
      lessonCount,
      images: product.images?.map((img) => ({
        ...img,
        url: img.videoUrl ? '' : this.storage.getAssetUrl(img.fileKey),
      })),
    };
  }

  async findPublished(query: {
    page?: number;
    pageSize?: number;
    categorySlug?: string;
    featured?: boolean;
    type?: string;
    types?: string[];
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 12));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductWhereInput = {
      published: true,
      ...(query.featured !== undefined && { featured: query.featured }),
      ...(query.categorySlug && {
        category: { slug: query.categorySlug },
      }),
      ...(query.types && query.types.length > 0 && { type: { in: query.types as any[] } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' } },
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

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true },
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
          take: 20,
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

    return {
      ...mapped,
      course,
      faqs: product.faqs.map((pf) => pf.faq),
      testimonials: product.testimonials.map((pt) => pt.testimonial),
    };
  }

  async search(q: string, page = 1, pageSize = 12) {
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
          images: { orderBy: { sortOrder: 'asc' } },
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

  async findSuggested(slug: string, count = 4) {
    const product = await this.prisma.product.findFirst({ where: { slug, published: true }, select: { id: true, categoryId: true } });
    if (!product) return [];

    const where: Prisma.ProductWhereInput = {
      published: true,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    };

    let items = await this.prisma.product.findMany({
      where,
      take: count,
      orderBy: { rating: 'desc' },
      include: { category: { select: { id: true, name: true, slug: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 }, course: { select: { _count: { select: { lessons: true } } } } },
    });

    if (items.length < count && product.categoryId) {
      const extra = await this.prisma.product.findMany({
        where: { published: true, id: { not: product.id }, categoryId: null },
        take: count - items.length,
        orderBy: { rating: 'desc' },
        include: { category: { select: { id: true, name: true, slug: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 }, course: { select: { _count: { select: { lessons: true } } } } },
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
}
