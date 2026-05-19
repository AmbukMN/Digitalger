import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getLessonsByProductSlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
            lessons: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!product?.course) {
      throw new NotFoundException('Course not found for this product');
    }

    const mapLesson = (lesson: any) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      durationSec: lesson.durationSec,
      sortOrder: lesson.sortOrder,
      isFreePreview: lesson.isFreePreview,
      moduleId: lesson.moduleId ?? null,
      hasVideo: Boolean(lesson.videoKey || lesson.videoUrl),
    });

    // Lessons with no module (ungrouped)
    const ungroupedLessons = product.course.lessons
      .filter((l) => !l.moduleId)
      .map(mapLesson);

    return {
      productId: product.id,
      productTitle: product.title,
      courseId: product.course.id,
      modules: product.course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        sortOrder: m.sortOrder,
        lessons: m.lessons.map(mapLesson),
      })),
      lessons: ungroupedLessons,
    };
  }

  async getLessonVideoUrl(productSlug: string, lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        course: { product: { slug: productSlug } },
      },
      include: {
        course: { include: { product: true } },
      },
    });

    if (!lesson?.videoKey && !lesson?.videoUrl) {
      throw new NotFoundException('Lesson video not found');
    }

    if (!lesson.isFreePreview) {
      const owned = await this.prisma.order.findFirst({
        where: {
          userId,
          status: OrderStatus.PAID,
          items: { some: { productId: lesson.course.productId } },
        },
      });
      if (!owned) {
        throw new NotFoundException('Access denied');
      }
    }

    if (lesson.videoUrl) {
      return { lessonId: lesson.id, url: lesson.videoUrl, expiresIn: null };
    }

    const url = await this.storage.getPresignedUrl(lesson.videoKey!, 7200, 'get');
    return { lessonId: lesson.id, url, expiresIn: 7200 };
  }
}
