import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { expandQuery } from '../../common/transliterate';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll(query: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
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

    const { compareAtPrice, discountEndsAt, howToUseSteps, categoryIds, ...rest } = dto;
    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : dto.categoryId;
    return this.prisma.product.create({
      data: {
        ...rest,
        categoryId: primaryCategoryId ?? rest.categoryId,
        categoryIds: categoryIds ?? (dto.categoryId ? [dto.categoryId] : []),
        price: new Prisma.Decimal(dto.price),
        ...(compareAtPrice !== undefined && {
          compareAtPrice: new Prisma.Decimal(compareAtPrice),
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
    await this.ensureProductExists(id);

    if (dto.slug) {
      const conflict = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException('Product slug already exists');
      }
    }

    const { price, compareAtPrice, discountEndsAt, howToUseSteps, categoryIds, ...rest } = dto;
    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : dto.categoryId;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(primaryCategoryId !== undefined && { categoryId: primaryCategoryId }),
        ...(categoryIds !== undefined && { categoryIds }),
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
  }

  async remove(id: string) {
    await this.ensureProductExists(id);
    return this.prisma.product.delete({ where: { id } });
  }

  async listImages(productId: string) {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    return images.map((img) => ({
      ...img,
      url: img.videoUrl ? '' : this.storage.getAssetUrl(img.fileKey),
    }));
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

  async createLesson(
    productId: string,
    dto: { title: string; description?: string; videoUrl?: string; videoKey?: string; durationSec?: number; isFreePreview?: boolean; sortOrder?: number; moduleId?: string },
  ) {
    const course = await this.ensureCourse(productId);
    const count = await this.prisma.lesson.count({ where: { courseId: course.id } });
    return this.prisma.lesson.create({
      data: {
        courseId: course.id,
        moduleId: dto.moduleId ?? null,
        title: dto.title,
        description: dto.description,
        videoUrl: dto.videoKey ? null : (dto.videoUrl ?? null),
        videoKey: dto.videoKey ?? null,
        durationSec: dto.durationSec,
        isFreePreview: dto.isFreePreview ?? false,
        sortOrder: dto.sortOrder ?? count,
      },
    });
  }

  async updateLesson(
    lessonId: string,
    dto: Partial<{ title: string; description: string; videoUrl: string; videoKey: string; durationSec: number; isFreePreview: boolean; sortOrder: number; moduleId: string | null }>,
  ) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.videoKey) data.videoUrl = null;
    else if (dto.videoUrl !== undefined) data.videoKey = null;
    return this.prisma.lesson.update({ where: { id: lessonId }, data });
  }

  async deleteLesson(lessonId: string) {
    return this.prisma.lesson.delete({ where: { id: lessonId } });
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

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
