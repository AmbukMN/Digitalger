import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export type ImageVariantSize = 'thumbnail' | 'medium' | 'large' | 'original';

export interface ImageVariant {
  size: ImageVariantSize;
  key: string;       // R2 key: 'uploads/uuid_thumbnail.webp'
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'image/webp';
}

export interface VideoProcessResult {
  key: string;       // R2 key: 'uploads/uuid_720p.mp4'
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'video/mp4';
  thumbnailKey: string;
  thumbnailBuffer: Buffer;
}

// thumbnail: 320px, medium: 800px, large: 1400px — нэгээс нь том бол resize хийхгүй
const VARIANTS: { size: ImageVariantSize; maxWidth: number; quality: number }[] = [
  { size: 'thumbnail', maxWidth: 320,  quality: 82 },
  { size: 'medium',    maxWidth: 800,  quality: 85 },
  { size: 'large',     maxWidth: 1400, quality: 87 },
];

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  isImage(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mimeType);
  }

  isSvg(mimeType: string): boolean {
    return mimeType === 'image/svg+xml';
  }

  isVideo(mimeType: string): boolean {
    return ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(mimeType);
  }

  isAnimatedGif(buffer: Buffer): boolean {
    // GIF header + animation check: байт дарааллаар шалгана
    if (buffer.length < 6) return false;
    const sig = buffer.slice(0, 6).toString('ascii');
    if (sig !== 'GIF87a' && sig !== 'GIF89a') return false;
    // Netscape looping block байгаа эсэхийг шалгана — animate тэмдэг
    return buffer.includes(Buffer.from('NETSCAPE2.0'));
  }

  buildVariantKey(folder: string, size: ImageVariantSize | 'thumb'): string {
    return `${folder}/${randomUUID()}_${size}.webp`;
  }

  buildVideoKey(folder: string, label: string): string {
    return `${folder}/${randomUUID()}_${label}.mp4`;
  }

  // ── Зураг боловсруулалт ──────────────────────────────────────────────────────
  async processImage(
    buffer: Buffer,
    mimeType: string,
    folder = 'uploads',
  ): Promise<ImageVariant[]> {
    const isGif = mimeType === 'image/gif';
    const animated = isGif && this.isAnimatedGif(buffer);
    const variants: ImageVariant[] = [];

    for (const v of VARIANTS) {
      try {
        let pipeline = sharp(buffer, { animated });

        const meta = await sharp(buffer, { animated }).metadata();
        const origW = meta.width ?? 9999;

        // Оригинал нь variant-аас жижиг бол resize хийхгүй
        if (origW > v.maxWidth) {
          pipeline = pipeline.resize({ width: v.maxWidth, withoutEnlargement: true });
        }

        const webpBuf = await pipeline
          .webp({ quality: v.quality, effort: 4, smartSubsample: true })
          .toBuffer({ resolveWithObject: false });

        const outMeta = await sharp(webpBuf, { animated }).metadata();

        variants.push({
          size: v.size,
          key: this.buildVariantKey(folder, v.size),
          buffer: webpBuf,
          width: outMeta.width ?? 0,
          height: outMeta.height ?? 0,
          bytes: webpBuf.length,
          mimeType: 'image/webp',
        });
      } catch (err) {
        this.logger.warn(`Variant ${v.size} failed: ${err}`);
      }
    }

    // original WebP — resize хийхгүй, зөвхөн format хөрвүүлнэ
    try {
      const origBuf = await sharp(buffer, { animated })
        .webp({ quality: 90, effort: 4, smartSubsample: true })
        .toBuffer();
      const origMeta = await sharp(origBuf, { animated }).metadata();
      variants.push({
        size: 'original',
        key: this.buildVariantKey(folder, 'original'),
        buffer: origBuf,
        width: origMeta.width ?? 0,
        height: origMeta.height ?? 0,
        bytes: origBuf.length,
        mimeType: 'image/webp',
      });
    } catch (err) {
      this.logger.warn(`Original WebP conversion failed: ${err}`);
    }

    return variants;
  }

  // ── Видео боловсруулалт ──────────────────────────────────────────────────────
  async processVideo(
    buffer: Buffer,
    folder = 'uploads',
  ): Promise<VideoProcessResult> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'btv-video-'));
    const inputPath = path.join(tmpDir, `input_${randomUUID()}`);
    const outputPath = path.join(tmpDir, `output_${randomUUID()}.mp4`);
    const thumbPath = path.join(tmpDir, `thumb_${randomUUID()}.jpg`);

    try {
      await fs.writeFile(inputPath, buffer);

      // 720p encode, H.264, AAC, web-optimized (faststart)
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-c:v libx264',
            '-crf 23',
            '-preset fast',
            '-vf scale=\'min(1280,iw)\':\'min(720,ih)\':force_original_aspect_ratio=decrease',
            '-c:a aac',
            '-b:a 128k',
            '-movflags +faststart',
            '-pix_fmt yuv420p',
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      // Thumbnail — 1 секундын frame
      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .outputOptions(['-ss 00:00:01', '-vframes 1', '-q:v 2'])
          .output(thumbPath)
          .on('end', () => resolve())
          .on('error', () => resolve()) // thumbnail алдаа гарвал үргэлжлүүлнэ
          .run();
      });

      const [videoBuf, thumbBuf] = await Promise.all([
        fs.readFile(outputPath),
        fs.readFile(thumbPath).catch(() => Buffer.alloc(0)),
      ]);

      // Video metadata
      const videoMeta = await this.getVideoMeta(outputPath);

      const videoKey = this.buildVideoKey(folder, '720p');
      const thumbKey = `${folder}/${randomUUID()}_thumb.webp`;

      // Thumbnail → WebP
      let thumbWebpBuf: Buffer = thumbBuf;
      if (thumbBuf.length > 0) {
        try {
          thumbWebpBuf = Buffer.from(
            await sharp(thumbBuf)
              .resize({ width: 800, withoutEnlargement: true })
              .webp({ quality: 85 })
              .toBuffer(),
          );
        } catch {
          thumbWebpBuf = thumbBuf;
        }
      }

      return {
        key: videoKey,
        buffer: videoBuf,
        width: videoMeta.width,
        height: videoMeta.height,
        bytes: videoBuf.length,
        mimeType: 'video/mp4',
        thumbnailKey: thumbKey,
        thumbnailBuffer: thumbWebpBuf,
      };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private getVideoMeta(filePath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err || !data) return resolve({ width: 0, height: 0 });
        const stream = data.streams.find((s) => s.codec_type === 'video');
        resolve({ width: stream?.width ?? 0, height: stream?.height ?? 0 });
      });
    });
  }
}
