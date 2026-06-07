import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CloudflareStreamService } from '../../storage/cloudflare-stream.service';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly stream: CloudflareStreamService,
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
      hasVideo: Boolean(lesson.videoKey || lesson.videoUrl || lesson.videoStreamId),
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

    // Видео эх сурвалж 3 хувилбар (mutually exclusive): videoStreamId | videoKey | videoUrl
    if (!lesson?.videoKey && !lesson?.videoUrl && !lesson?.videoStreamId) {
      throw new NotFoundException('Lesson video not found');
    }

    // Entitlement шалгалт — preview биш бол PAID order заавал (бүх эх сурвалжид адил).
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

    // 1) Cloudflare Stream (ШИНЭ) — signed playback token.
    if (lesson.videoStreamId) {
      if (!this.stream.configured) {
        throw new NotFoundException('Stream тохируулаагүй байна');
      }
      const ttl = 7200;
      let token: string;
      try {
        token = await this.stream.getSignedPlaybackToken(lesson.videoStreamId, ttl);
      } catch {
        throw new NotFoundException('Playback token үүсгэж чадсангүй');
      }
      return {
        lessonId: lesson.id,
        type: 'stream' as const,
        streamToken: token,
        hlsUrl: this.stream.hlsUrl(lesson.videoStreamId, token),
        iframeUrl: this.stream.iframeUrl(token),
        expiresIn: ttl,
      };
    }

    // 2) Гадаад линк (YouTube/Vimeo) — хэвээр.
    if (lesson.videoUrl) {
      return { lessonId: lesson.id, type: 'external' as const, url: lesson.videoUrl, expiresIn: null };
    }

    // 3) R2 presigned (хуучин) — хэвээр.
    const url = await this.storage.getPresignedUrl(lesson.videoKey!, 7200, 'get');
    return { lessonId: lesson.id, type: 'r2' as const, url, expiresIn: 7200 };
  }

  /**
   * Тухайн хичээлд хэрэглэгчид хандах эрх (entitlement) байгаа эсэхийг шалгана.
   * isFreePreview бол үргэлж зөвшөөрнө, эс бол PAID order заавал.
   * Хэрэглэлгүй бол ForbiddenException шиднэ.
   */
  private async ensureLessonAccess(productSlug: string, lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, course: { product: { slug: productSlug } } },
      include: { course: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
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
        throw new ForbiddenException('Access denied');
      }
    }
    return lesson;
  }

  /**
   * Хичээл үзэлтийн явц хадгална (continue watching + дууссан тэмдэглэгээ).
   * watchedSeconds нь сүүлд зогссон байрлал. durationSec*0.9-аас давсан бол completed=true.
   */
  async saveLessonProgress(
    productSlug: string,
    lessonId: string,
    userId: string,
    dto: { watchedSeconds: number; durationSec?: number; completed?: boolean },
  ) {
    await this.ensureLessonAccess(productSlug, lessonId, userId);

    const watchedSeconds = Math.max(0, Math.floor(dto.watchedSeconds ?? 0));
    const durationSec =
      dto.durationSec !== undefined && dto.durationSec !== null
        ? Math.max(0, Math.floor(dto.durationSec))
        : undefined;

    // 90%-аас дээш үзсэн бол автоматаар дууссан гэж тэмдэглэнэ.
    const autoCompleted =
      durationSec && durationSec > 0 ? watchedSeconds >= durationSec * 0.9 : false;
    const completed = dto.completed ?? autoCompleted;

    const progress = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        watchedSeconds,
        ...(durationSec !== undefined && { durationSec }),
        completed,
      },
      update: {
        watchedSeconds,
        ...(durationSec !== undefined && { durationSec }),
        completed,
      },
    });

    return {
      lessonId: progress.lessonId,
      watchedSeconds: progress.watchedSeconds,
      durationSec: progress.durationSec,
      completed: progress.completed,
    };
  }

  /**
   * Тухайн course-ийн бүх хичээлд хэрэглэгчийн үзэлтийн явц.
   * Continue watching болон явцын мөрөнд ашиглана.
   */
  async getCourseProgress(productSlug: string, userId: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug },
      select: { course: { select: { id: true } } },
    });
    if (!product?.course) {
      throw new NotFoundException('Course not found for this product');
    }

    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, lesson: { courseId: product.course.id } },
      select: { lessonId: true, watchedSeconds: true, durationSec: true, completed: true },
    });

    return progress;
  }
}
