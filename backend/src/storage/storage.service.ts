import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// In-memory LRU cache — Redis-д хандахгүйгээр хурдан авна
// TTL: presign expiresIn-с 60 секунд хасна (expire болохоос өмнө шинэчлэнэ)
const presignCache = new Map<string, { url: string; expiresAt: number }>();
const PRESIGN_CACHE_MAX = 5000;

function getCachedPresign(key: string, expiresIn: number): string | null {
  const entry = presignCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { presignCache.delete(key); return null; }
  return entry.url;
}

function setCachedPresign(key: string, url: string, expiresIn: number) {
  if (presignCache.size >= PRESIGN_CACHE_MAX) {
    // Хамгийн хуучин entry-г устгана
    presignCache.delete(presignCache.keys().next().value!);
  }
  presignCache.set(key, { url, expiresAt: Date.now() + (expiresIn - 60) * 1000 });
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string | undefined;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const r2 = this.config.get('r2');
    this.bucket = r2.bucket;
    this.publicUrl = r2.publicUrl?.replace(/\/$/, '');

    this.configured = Boolean(
      r2.accessKeyId && r2.secretAccessKey && r2.endpoint,
    );

    if (this.configured) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: r2.endpoint,
        credentials: {
          accessKeyId: r2.accessKeyId!,
          secretAccessKey: r2.secretAccessKey!,
        },
      });
    } else {
      this.client = null;
      this.logger.warn('R2 storage not configured — uploads will be mocked');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getAssetUrl(key: string): string {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    if (this.publicUrl) {
      return `${this.publicUrl}/${key.replace(/^\//, '')}`;
    }
    return key;
  }

  buildKey(folder: string, fileName: string): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const base = randomUUID();
    return ext ? `${folder}/${base}.${ext}` : `${folder}/${base}`;
  }

  async upload(
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<string> {
    if (!this.client) {
      this.logger.debug(`Mock upload: ${key}`);
      return key;
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public,max-age=31536000,immutable',
      }),
    );

    return key;
  }

  async getPresignedUrl(
    key: string,
    expiresIn = 3600,
    operation: 'get' | 'put' = 'get',
  ): Promise<string> {
    if (!this.client) {
      return this.getAssetUrl(key);
    }

    // PUT presign кэшлэхгүй — нэг удаа хэрэглэнэ
    if (operation === 'get') {
      const cacheKey = `${key}:${expiresIn}`;
      const cached = getCachedPresign(cacheKey, expiresIn);
      if (cached) return cached;

      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
      setCachedPresign(cacheKey, url, expiresIn);
      return url;
    }

    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;

    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  // R2-аас файлыг Buffer болгож татах (ЖИЖИГ файлд — memory). Том видеонд
  // downloadToFile ашигла (246MB+ memory-д татвал worker OOM).
  async downloadBuffer(key: string): Promise<Buffer> {
    if (!this.client) throw new Error('Storage client not configured');
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = res.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // R2-аас файлыг ДИСК рүү stream-ээр татах (том видео — memory дүүргэхгүй,
  // OOM-аас сэргийлнэ). worker HLS хөрвүүлэлтэд 246MB+ raw видеонд ашиглана.
  async downloadToFile(key: string, destPath: string): Promise<void> {
    if (!this.client) throw new Error('Storage client not configured');
    const { createWriteStream } = await import('fs');
    const { pipeline } = await import('stream/promises');
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    await pipeline(res.Body as NodeJS.ReadableStream, createWriteStream(destPath));
  }

  /**
   * R2 bucket дахь БҮХ object-ийг (key + LastModified) жагсаана (pagination-тай).
   * Orphan cleanup-д ашиглана. prefix өгвөл зөвхөн тэр хавтаснаас.
   * ⚠️ Том bucket-д хэдэн арван мянган key байж болно — cron дотор л дуудна.
   */
  async listAllKeys(
    prefix?: string,
  ): Promise<{ key: string; lastModified?: Date; size?: number }[]> {
    if (!this.client) return [];
    const out: { key: string; lastModified?: Date; size?: number }[] = [];
    let token: string | undefined = undefined;
    do {
      const res: import('@aws-sdk/client-s3').ListObjectsV2CommandOutput =
        await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: token,
            MaxKeys: 1000,
          }),
        );
      for (const o of res.Contents ?? []) {
        if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified, size: o.Size });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  // Variant-уудыг зэрэг R2-д хуулна
  async uploadMany(
    items: { key: string; buffer: Buffer; contentType: string }[],
  ): Promise<void> {
    await Promise.all(items.map((item) => this.upload(item.key, item.buffer, item.contentType)));
  }
}
