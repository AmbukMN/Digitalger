import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CoursesService } from './courses.service';

/**
 * CoursesService entitlement unit тест.
 * PrismaService + StorageService + CloudflareStreamService бүгдийг mock хийсэн.
 * Гол логик: getLessonVideoUrl — isFreePreview/PAID шалгалт; getCourseProgress.
 */
describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: any;
  let storage: any;
  let stream: any;

  beforeEach(() => {
    prisma = {
      lesson: { findFirst: jest.fn() },
      order: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      lessonProgress: { findMany: jest.fn(), upsert: jest.fn() },
    };
    storage = { getPresignedUrl: jest.fn().mockResolvedValue('https://r2.signed/video') };
    stream = {
      configured: true,
      getSignedPlaybackToken: jest.fn().mockResolvedValue('tok-123'),
      hlsUrl: jest.fn().mockReturnValue('https://hls'),
      iframeUrl: jest.fn().mockReturnValue('https://iframe'),
    };
    const config = { get: jest.fn().mockReturnValue('https://digitalger.mn') };
    service = new CoursesService(prisma as any, storage as any, stream as any, config as any);
  });

  describe('getLessonVideoUrl', () => {
    it('видео эх сурвалжгүй хичээл → NotFoundException', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l1',
        isFreePreview: false,
        videoKey: null,
        videoUrl: null,
        videoStreamId: null,
        course: { productId: 'prod-1', product: {} },
        resources: [],
      });

      await expect(
        service.getLessonVideoUrl('slug', 'l1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('isFreePreview=true → эзэмшил шалгалтгүй (R2) url буцаана', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l2',
        isFreePreview: true,
        videoKey: 'videos/l2.mp4',
        videoUrl: null,
        videoStreamId: null,
        content: 'lesson content',
        course: { productId: 'prod-1', product: {} },
        resources: [],
      });

      const res: any = await service.getLessonVideoUrl('slug', 'l2', 'user-1');

      expect(res.type).toBe('r2');
      expect(res.url).toBe('https://r2.signed/video');
      // free preview — order шалгахгүй
      expect(prisma.order.findFirst).not.toHaveBeenCalled();
    });

    it('preview биш + PAID эзэмшээгүй → NotFoundException (Access denied)', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l3',
        isFreePreview: false,
        videoKey: 'videos/l3.mp4',
        videoUrl: null,
        videoStreamId: null,
        course: { productId: 'prod-1', product: {} },
        resources: [],
      });
      prisma.order.findFirst.mockResolvedValue(null); // эзэмшээгүй

      await expect(
        service.getLessonVideoUrl('slug', 'l3', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('preview биш + PAID эзэмшсэн → url буцаана', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l4',
        isFreePreview: false,
        videoKey: 'videos/l4.mp4',
        videoUrl: null,
        videoStreamId: null,
        content: null,
        course: { productId: 'prod-1', product: {} },
        resources: [],
      });
      prisma.order.findFirst.mockResolvedValue({ id: 'order-paid' });

      const res: any = await service.getLessonVideoUrl('slug', 'l4', 'user-1');

      expect(res.type).toBe('r2');
      expect(res.url).toBe('https://r2.signed/video');
      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: OrderStatus.PAID,
          }),
        }),
      );
    });

    it('videoStreamId-тэй + эзэмшсэн → stream playback token буцаана', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l5',
        isFreePreview: false,
        videoKey: null,
        videoUrl: null,
        videoStreamId: 'stream-abc',
        content: null,
        course: { productId: 'prod-1', product: {} },
        resources: [],
      });
      prisma.order.findFirst.mockResolvedValue({ id: 'order-paid' });

      const res: any = await service.getLessonVideoUrl('slug', 'l5', 'user-1');

      expect(res.type).toBe('stream');
      expect(res.streamToken).toBe('tok-123');
      expect(stream.getSignedPlaybackToken).toHaveBeenCalledWith('stream-abc', 7200);
    });

    it('external videoUrl + эзэмшсэн → external type', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l6',
        isFreePreview: true,
        videoKey: null,
        videoUrl: 'https://youtube.com/x',
        videoStreamId: null,
        content: null,
        course: { productId: 'prod-1', product: {} },
        resources: [],
      });

      const res: any = await service.getLessonVideoUrl('slug', 'l6', 'user-1');

      expect(res.type).toBe('external');
      expect(res.url).toBe('https://youtube.com/x');
    });
  });

  describe('getCourseProgress', () => {
    it('course олдохгүй → NotFoundException', async () => {
      prisma.product.findFirst.mockResolvedValue({ course: null });

      await expect(
        service.getCourseProgress('slug', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('course олдвол хэрэглэгчийн progress жагсаалт буцаана', async () => {
      prisma.product.findFirst.mockResolvedValue({ course: { id: 'course-1' } });
      const rows = [
        { lessonId: 'l1', watchedSeconds: 30, durationSec: 100, completed: false },
        { lessonId: 'l2', watchedSeconds: 100, durationSec: 100, completed: true },
      ];
      prisma.lessonProgress.findMany.mockResolvedValue(rows);

      const res = await service.getCourseProgress('slug', 'user-1');

      expect(res).toEqual(rows);
      expect(prisma.lessonProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            lesson: { courseId: 'course-1' },
          }),
        }),
      );
    });
  });
});
