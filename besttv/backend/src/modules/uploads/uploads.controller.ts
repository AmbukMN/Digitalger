import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Role } from '@prisma/client';
import { diskStorage, memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import path from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessorService } from '../../storage/image-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VIDEO_QUEUE, VideoHlsJob, VideoTarget } from '../videos/video-queue.types';

const IMAGE_SIZE_LIMIT = 30 * 1024 * 1024; // 30MB — зураг backend-ээр дамжина
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly prisma: PrismaService,
    @InjectQueue(VIDEO_QUEUE) private readonly videoQueue: Queue<VideoHlsJob>,
  ) {}

  /**
   * Зураг (poster/backdrop/episode still/cast photo/gallery) — sharp WebP
   * болгоод R2-д. kind: poster → 600px, backdrop/gallery → 1920px,
   * still → 800px, cast → 300px (dэлгэрэнгүй биш жижиг зураг)
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGE_SIZE_LIMIT },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') kind: 'poster' | 'backdrop' | 'still' | 'cast' | 'gallery' = 'poster',
  ) {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Зөвшөөрөгдөөгүй зургийн төрөл: ${file.mimetype}`);
    }

    const sharp = (await import('sharp')).default;
    const maxWidth =
      kind === 'backdrop' || kind === 'gallery' ? 1920 : kind === 'cast' ? 300 : kind === 'still' ? 800 : 600;
    const buf = await sharp(file.buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 90, effort: 4, smartSubsample: true })
      .toBuffer();

    const key = `images/${kind}/${this.storage.buildKey(kind, 'img.webp').split('/').pop()}`;
    await this.storage.upload(key, buf, 'image/webp');

    return { key, url: await this.storage.publicAssetUrl(key, 7200) };
  }

  /** Storage драйверийг frontend танихад (R2=presign PUT, local=шууд upload endpoint) */
  @Post('video/init')
  async initVideoUpload() {
    return { mode: this.storage.isLocal ? 'local' : 'r2' } as const;
  }

  /**
   * Видео — том тул browser ШУУД R2 руу (presigned PUT).
   * Урсгал: 1) энэ endpoint → uploadUrl 2) browser PUT 3) /video/complete
   */
  @Post('video/presign')
  async presignVideo(@Body() body: { fileName: string }) {
    const { fileName } = body;
    if (!fileName) throw new BadRequestException('fileName шаардлагатай');

    const ext = path.extname(fileName).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`Видео файлын төрөл биш: ${ext}`);
    }

    const key = this.storage.buildKey('raw', fileName);
    const uploadUrl = await this.storage.presignPut(key, 4 * 3600);
    return { uploadUrl, key };
  }

  /**
   * ЛОКАЛ ДИСК горим — R2 байхгүй үед видеог шууд backend-ээр дискэнд бичнэ
   * (browser→backend, R2 presign боломжгүй тул). Том файл тул memoryStorage
   * биш diskStorage ашиглана (RAM дүүргэхгүй, шууд tmp зам руу stream бичнэ).
   */
  @Post('video/direct')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.resolve(process.cwd(), 'storage', 'raw');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB дээд
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, VIDEO_EXTENSIONS.has(ext));
      },
    }),
  )
  async uploadVideoDirect(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Видео файл сонгоогүй эсвэл дэмжигдэхгүй төрөл байна');
    const key = `raw/${file.filename}`;
    return { key };
  }

  /** Upload дууссаны дараа — HLS хөрвүүлэлтийн queue-д нэмнэ */
  @Post('video/complete')
  async completeVideo(
    @Body() body: { target: VideoTarget; targetId: string; rawKey: string },
  ) {
    const { target, targetId, rawKey } = body;
    if (!target || !targetId || !rawKey) {
      throw new BadRequestException('target, targetId, rawKey шаардлагатай');
    }

    // Entity байгаа эсэх + статус PROCESSING болгоно
    if (target === 'movie' || target === 'trailer') {
      const title = await this.prisma.title.findUnique({ where: { id: targetId } });
      if (!title) throw new NotFoundException('Контент олдсонгүй');
      if (target === 'movie') {
        await this.prisma.title.update({
          where: { id: targetId },
          data: { videoRawKey: rawKey, streamStatus: 'PROCESSING' },
        });
      }
      // trailer: streamStatus нь movie-д зориулагдсан тул хөндөхгvй, HLS
      // хөрвvvлэлт дуусахад worker шууд trailerKey-г бичнэ.
    } else {
      const ep = await this.prisma.episode.findUnique({ where: { id: targetId } });
      if (!ep) throw new NotFoundException('Анги олдсонгүй');
      await this.prisma.episode.update({
        where: { id: targetId },
        data: { videoRawKey: rawKey, streamStatus: 'PROCESSING' },
      });
    }

    await this.videoQueue.add(
      'convert',
      { target, targetId, rawKey },
      { attempts: 2, backoff: { type: 'fixed', delay: 30_000 }, removeOnComplete: 50 },
    );

    return { ok: true, status: 'PROCESSING' };
  }
}
