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
import * as fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';

// In-memory LRU кэш — presign нь локал crypto үйлдэл ч, m3u8 rewrite үед
// нэг playlist-д хэдэн зуун segment presign хийгддэг тул кэш чухал.
const presignCache = new Map<string, { url: string; expiresAt: number }>();
const PRESIGN_CACHE_MAX = 20000;

function getCachedPresign(key: string): string | null {
  const entry = presignCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    presignCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCachedPresign(key: string, url: string, expiresIn: number) {
  if (presignCache.size >= PRESIGN_CACHE_MAX) {
    presignCache.delete(presignCache.keys().next().value!);
  }
  presignCache.set(key, { url, expiresAt: Date.now() + (expiresIn - 60) * 1000 });
}

/**
 * BestTV storage — 2 драйвертэй:
 *  - R2 (production): private bucket, бүх хандалт presigned URL-ээр
 *  - Local disk (эхлэл шат): VPS/локал дискний `storage/` хавтас,
 *    `/media/*` статик route-аар шууд serve хийнэ (main.ts-д холбогдсон).
 *
 * ⚠️ R2_ACCESS_KEY_ID тохируулаагүй бол автоматаар LOCAL горимд орно —
 * код солихгүйгээр production-д R2 руу шилжих боломжтой (env л өөрчилнө).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly configured: boolean;
  private readonly localRoot: string;
  private readonly localBaseUrl: string;
  /** Нийтийн asset CDN домэйн (R2_PUBLIC_URL). Тохируулаагүй бол undefined. */
  private readonly publicUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    const r2 = this.config.get('r2');
    this.bucket = r2.bucket;
    this.localRoot = path.resolve(process.cwd(), 'storage');
    this.localBaseUrl = this.config.get<string>('backendUrl') ?? 'http://localhost:4100';
    this.publicUrl = r2.publicUrl?.replace(/\/$/, '') || undefined;

    this.configured = Boolean(r2.accessKeyId && r2.secretAccessKey && r2.endpoint);

    if (this.configured) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: r2.endpoint,
        credentials: {
          accessKeyId: r2.accessKeyId!,
          secretAccessKey: r2.secretAccessKey!,
        },
        /**
         * ⚠️⚠️ R2-д ЗААВАЛ ХЭРЭГТЭЙ. AWS SDK v3 (≥3.729) нь default-оор бүх
         * PutObject-д CRC32 checksum нэмдэг → presigned URL-д
         * `x-amz-checksum-crc32` + `x-amz-sdk-checksum-algorithm` header
         * шаардагдана. Browser PUT хийхэд:
         *   1) тэр header-үүдийг илгээдэггүй → SignatureDoesNotMatch
         *   2) preflight-д R2 зөвшөөрдөггүй → CORS алдаа
         * WHEN_REQUIRED болгосноор presign цэвэр, browser шууд PUT хийнэ.
         */
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      this.logger.log('R2 storage идэвхжлээ (private bucket, presigned URL)');
    } else {
      this.client = null;
      this.logger.warn(
        `R2 тохируулаагүй — ЛОКАЛ ДИСК горимд (${this.localRoot}). Production-д R2_* env тохируулна уу.`,
      );
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  get isLocal(): boolean {
    return !this.configured;
  }

  buildKey(folder: string, fileName: string): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const base = randomUUID();
    return ext ? `${folder}/${base}.${ext}` : `${folder}/${base}`;
  }

  private localPath(key: string): string {
    return path.join(this.localRoot, key);
  }

  async upload(key: string, body: Buffer, contentType?: string): Promise<string> {
    if (!this.client) {
      const dest = this.localPath(key);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, body);
      return key;
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        /**
         * ⚠️ `immutable` ХЭРЭГЛЭХГҮЙ — дэлгэрэнгүйг `presignGet` дээрх
         * тайлбараас үз. Товчоор: CORS буруу үед browser нь CORS-гүй хариуг
         * МӨНХӨД кэшилж, сервер талын засвар хүрэхээ болино.
         * 7 хоног нь хурдны хувьд бараг ижил, гэхдээ сэргээх боломжтой.
         */
        CacheControl: 'public, max-age=604800',
      }),
    );
    return key;
  }

  async uploadMany(
    items: { key: string; buffer: Buffer; contentType: string }[],
  ): Promise<void> {
    await Promise.all(
      items.map((item) => this.upload(item.key, item.buffer, item.contentType)),
    );
  }

  /**
   * Нийтийн (эрх шаарддаггүй) asset-ын URL — зураг, постер, backdrop, avatar.
   *
   * R2_PUBLIC_URL тохируулсан бол CDN-ээс ШУУД (presign-гүй) — Cloudflare
   * кэшлэх тул хамаагүй хурдан. Тохируулаагүй бол presign руу уналаа.
   *
   * ⚠️ ВИДЕОНД ХЭРЭГЛЭХГҮЙ — HLS нь эрхийн шалгалттай тул presignGet ашиглана.
   */
  async publicAssetUrl(key: string, expiresIn = 7200): Promise<string> {
    if (!key) return '';
    if (this.publicUrl && this.client) {
      return `${this.publicUrl}/${key.replace(/^\//, '')}`;
    }
    return this.presignGet(key, expiresIn);
  }

  /**
   * GET presign — R2: signed URL (кэштэй). Local: статик /media/* URL шууд.
   *
   * ⚠️⚠️ `ResponseCacheControl` — ЯАГААД ЗААВАЛ ХЭРЭГТЭЙ ВЭ:
   *
   * Объектууд upload хийгдэхдээ `public,max-age=31536000,immutable` гэсэн
   * metadata-тай бичигддэг (доорх `upload()`). `immutable` гэдэг нь browser-т
   * "ХЭЗЭЭ Ч дахин бүү шалга" гэсэн үг — маш хурдан ч, НЭГ АЮУЛТАЙ:
   *
   *   Bucket дээр CORS БАЙХГҮЙ үед хэрэглэгчийн browser нь segment-ийг
   *   татаад, `Access-Control-Allow-Origin`-ГҮЙ хариуг 1 ЖИЛ кэшилдэг.
   *   Дараа нь bucket-ийн CORS-ыг зассан ч browser сервер рүү ОГТ ХАНДАХГҮЙ
   *   тул хуучин, CORS-гүй хариугаа гаргасаар байна → видео тоглохгүй,
   *   console дүүрэн "blocked by CORS policy". Засвар хүрэхгүй, хэрэглэгч
   *   кэшээ ГАРААР цэвэрлэхээс өөр аргагүй болно (бодит тохиолдол гарсан).
   *
   * `ResponseCacheControl` нь presign дотор явж, R2-г объектын metadata-ын
   * ОРОНД энэ утгыг буцаахыг шаарддаг — 4578 объектыг дахин бичихгүйгээр
   * кэшийн бодлогыг УДИРДАНА.
   *
   * 7 хоног + `immutable`-гүй: segment-үүд хэвээрээ хурдан кэшлэгдэнэ
   * (нэг кино үзэхэд хангалттай урт), гэхдээ browser шаардлагатай үед
   * дахин баталгаажуулах боломжтой тул ийм "хордсон кэш" мөнхөрөхгүй.
   */
  async presignGet(key: string, expiresIn = 7200): Promise<string> {
    if (!this.client) return `${this.localBaseUrl}/media/${key}`;

    const cacheKey = `${key}:${expiresIn}`;
    const cached = getCachedPresign(cacheKey);
    if (cached) return cached;

    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseCacheControl: 'public, max-age=604800',
      }),
      { expiresIn },
    );
    setCachedPresign(cacheKey, url, expiresIn);
    return url;
  }

  /**
   * PUT presign — R2: browser шууд R2 руу upload.
   * Local: presign URL байхгүй тул admin uploads controller үүнийг шалгаад
   * оронд нь backend-ээр дамжуулах endpoint руу чиглүүлнэ (isLocal true үед).
   */
  async presignPut(key: string, expiresIn = 3600): Promise<string> {
    if (!this.client) return key;
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      await fs.rm(this.localPath(key), { force: true });
      return;
    }
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Хавтас бүхэлд нь устгах (HLS segment-үүд — title устгахад) */
  async deletePrefix(prefix: string): Promise<number> {
    if (!this.client) {
      const dir = this.localPath(prefix);
      if (!existsSync(dir)) return 0;
      const files = await fs.readdir(dir, { recursive: true }).catch(() => []);
      await fs.rm(dir, { recursive: true, force: true });
      return files.length;
    }
    const keys = await this.listAllKeys(prefix);
    await Promise.all(keys.map((k) => this.delete(k.key)));
    return keys.length;
  }

  /** ЖИЖИГ файлыг Buffer болгож татах (m3u8 текст г.м.) */
  async downloadBuffer(key: string): Promise<Buffer> {
    if (!this.client) return fs.readFile(this.localPath(key));
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

  /** m3u8 playlist текстээр унших (stream gate rewrite-д) */
  async downloadText(key: string): Promise<string> {
    return (await this.downloadBuffer(key)).toString('utf-8');
  }

  /**
   * Том видеог ДИСК рүү stream-ээр татах — memory дүүргэхгүй.
   * ⚠️ 246MB+ Buffer-д татвал worker OOM (DigitalGer дээр батлагдсан сургамж).
   */
  async downloadToFile(key: string, destPath: string): Promise<void> {
    if (!this.client) {
      await pipeline(createReadStream(this.localPath(key)), createWriteStream(destPath));
      return;
    }
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    await pipeline(res.Body as NodeJS.ReadableStream, createWriteStream(destPath));
  }

  async listAllKeys(
    prefix?: string,
  ): Promise<{ key: string; lastModified?: Date; size?: number }[]> {
    if (!this.client) {
      const dir = this.localPath(prefix ?? '');
      if (!existsSync(dir)) return [];
      const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
      const out: { key: string; lastModified?: Date; size?: number }[] = [];
      for (const e of entries as import('fs').Dirent[]) {
        if (!e.isFile()) continue;
        const full = path.join(e.parentPath ?? dir, e.name);
        const rel = path.relative(this.localRoot, full).split(path.sep).join('/');
        const stat = await fs.stat(full).catch(() => null);
        out.push({ key: rel, lastModified: stat?.mtime, size: stat?.size });
      }
      return out;
    }

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
}
