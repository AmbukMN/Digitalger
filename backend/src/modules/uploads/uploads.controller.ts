import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessorService } from '../../storage/image-processor.service';
import path from 'path';

// Файлын хэмжээний хязгаар: зураг/doc 100MB, видео/том файл presigned URL ашиглана
const PROXY_SIZE_LIMIT = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml',
  // Video
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  // Design
  'application/octet-stream',
  'application/x-figma',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dmg',
  '.dll', '.so', '.bin', '.com', '.scr', '.vbs', '.js',
  '.php', '.py', '.rb', '.pl', '.cgi',
]);

export interface UploadVariantInfo {
  size: string;
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  // Зургийн variant мэдээлэл (key + url + metadata)
  variantData?: UploadVariantInfo[];
  // Видеоны thumbnail
  thumbnailUrl?: string;
  thumbnailKey?: string;
}

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  /** Том файлд (видео, архив) presigned PUT URL буцаана — browser шууд R2-д upload хийнэ */
  @Post('presign')
  async presign(
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const { fileName, contentType, folder = 'uploads' } = body;
    if (!fileName || !contentType) throw new BadRequestException('fileName, contentType шаардлагатай');

    const ext = path.extname(fileName).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) throw new BadRequestException(`Тохирохгүй файлын төрөл: ${ext}`);

    const key = this.storage.buildKey(folder, fileName);
    const uploadUrl = await this.storage.getPresignedUrl(key, 3600, 'put');
    return { uploadUrl, key, publicUrl: this.storage.getAssetUrl(key) };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PROXY_SIZE_LIMIT },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');

    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`Тохирохгүй файлын төрөл: ${ext}`);
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Зөвшөөрөгдөөгүй MIME төрөл: ${file.mimetype}`);
    }

    // ── SVG — боловсруулалтгүй шууд хуулна ─────────────────────────────────────
    if (this.imageProcessor.isSvg(file.mimetype)) {
      const key = this.storage.buildKey('uploads', file.originalname);
      await this.storage.upload(key, file.buffer, file.mimetype);
      return { key, url: this.storage.getAssetUrl(key), fileName: file.originalname, mimeType: file.mimetype, size: file.size };
    }

    // ── Зураг (JPEG/PNG/WebP/GIF/AVIF) ─────────────────────────────────────────
    if (this.imageProcessor.isImage(file.mimetype)) {
      const variants = await this.imageProcessor.processImage(file.buffer, file.mimetype, 'uploads');

      if (variants.length === 0) {
        // Боловсруулалт амжилтгүй — оригинал хуулна
        const key = this.storage.buildKey('uploads', file.originalname);
        await this.storage.upload(key, file.buffer, file.mimetype);
        return { key, url: this.storage.getAssetUrl(key), fileName: file.originalname, mimeType: file.mimetype, size: file.size };
      }

      await this.storage.uploadMany(
        variants.map((v) => ({ key: v.key, buffer: v.buffer, contentType: v.mimeType })),
      );

      // primary = original variant (эсвэл байгаа хамгийн том)
      const original = variants.find((v) => v.size === 'original') ?? variants[variants.length - 1];

      return {
        key: original.key,
        url: this.storage.getAssetUrl(original.key),
        fileName: file.originalname,
        mimeType: 'image/webp',
        size: original.bytes,
        variantData: variants.map((v) => ({
          size: v.size,
          key: v.key,
          url: this.storage.getAssetUrl(v.key),
          width: v.width,
          height: v.height,
          bytes: v.bytes,
        })),
      };
    }

    // ── Видео — ffmpeg encode ────────────────────────────────────────────────────
    if (this.imageProcessor.isVideo(file.mimetype)) {
      const result = await this.imageProcessor.processVideo(file.buffer, 'uploads');

      const uploads: { key: string; buffer: Buffer; contentType: string }[] = [
        { key: result.key, buffer: result.buffer, contentType: 'video/mp4' },
      ];
      if (result.thumbnailBuffer.length > 0) {
        uploads.push({ key: result.thumbnailKey, buffer: result.thumbnailBuffer, contentType: 'image/webp' });
      }

      await this.storage.uploadMany(uploads);

      return {
        key: result.key,
        url: this.storage.getAssetUrl(result.key),
        fileName: file.originalname,
        mimeType: 'video/mp4',
        size: result.bytes,
        thumbnailUrl: result.thumbnailBuffer.length > 0 ? this.storage.getAssetUrl(result.thumbnailKey) : undefined,
        thumbnailKey: result.thumbnailBuffer.length > 0 ? result.thumbnailKey : undefined,
      };
    }

    // ── Бусад файл (document, archive, design) — шууд хуулна ───────────────────
    const key = this.storage.buildKey('uploads', file.originalname);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return { key, url: this.storage.getAssetUrl(key), fileName: file.originalname, mimeType: file.mimetype, size: file.size };
  }
}
