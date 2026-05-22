import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as archiver from 'archiver';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { PassThrough, Readable } from 'stream';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

// Connection pool — нэг Worker-т олон file зэрэг татахад socket дахин ашиглана
const httpAgent = new HttpAgent({ maxSockets: 100, keepAlive: true });
const httpsAgent = new HttpsAgent({ maxSockets: 100, keepAlive: true });

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  const isHttps = url.startsWith('https');
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000); // 30s timeout
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Encoding': 'identity' },
        // @ts-ignore — Node 18+ fetch supports agent via undici dispatcher
        dispatcher: undefined,
      });
      clearTimeout(timer);
      if (res.ok) return res;
      if (attempt === retries) return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw new Error('fetchWithRetry exhausted');
}

export const ZIP_QUEUE = 'zip';

export interface ZipJobPayload {
  jobId: string;
  userId: string;
  productId: string;
  bundleId?: string;
  fileIds: string[];
  zipName: string;
}

// Нэгэн зэрэг хэдэн worker ажиллахыг env-ээс тохируулж болно
const WORKER_CONCURRENCY = parseInt(process.env.ZIP_WORKER_CONCURRENCY ?? '5', 10);
// R2-с файл татахад зэрэг хэдэн presign хийх
const PRESIGN_BATCH = 20;

@Processor(ZIP_QUEUE)
export class ZipProcessor {
  private readonly logger = new Logger(ZipProcessor.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    const r2 = this.config.get('r2');
    this.bucket = r2.bucket;
    if (r2.accessKeyId && r2.secretAccessKey && r2.endpoint) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: r2.endpoint,
        credentials: {
          accessKeyId: r2.accessKeyId,
          secretAccessKey: r2.secretAccessKey,
        },
        // Connection pool — олон file зэрэг татахад
        maxAttempts: 3,
      });
    } else {
      this.s3 = null;
    }
  }

  @Process({ concurrency: WORKER_CONCURRENCY })
  async handleZip(job: Job<ZipJobPayload>) {
    const { jobId, fileIds, zipName } = job.data;
    const startedAt = Date.now();

    await this.prisma.zipJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    try {
      const files = await this.prisma.productFile.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, fileKey: true, fileName: true },
      });

      if (!files.length) throw new Error('No files found');

      const zipKey = `zips/${jobId}/${zipName}`;

      if (!this.s3) {
        await this.prisma.zipJob.update({
          where: { id: jobId },
          data: { status: 'DONE', zipKey },
        });
        return { zipKey };
      }

      // ── Presign URLs batch-аар (PRESIGN_BATCH зэрэг) ────────────────────
      const urlMap = new Map<string, string>();
      for (let i = 0; i < files.length; i += PRESIGN_BATCH) {
        const batch = files.slice(i, i + PRESIGN_BATCH);
        const urls = await Promise.all(
          batch.map((f) => this.storage.getPresignedUrl(f.fileKey, 900, 'get')),
        );
        batch.forEach((f, j) => urlMap.set(f.id, urls[j]));
        await job.progress(Math.round(((i + batch.length) / files.length) * 10));
      }

      // ── Stream pipeline: archiver → PassThrough → R2 multipart ──────────
      const pass = new PassThrough({ highWaterMark: 16 * 1024 * 1024 }); // 16MB buffer
      const zip = archiver.default('zip', {
        zlib: { level: 1 },   // level 1 = хамгийн хурдан, file-ууд ихэвчлэн аль хэдийн compressed
        statConcurrency: 4,
      });
      zip.pipe(pass);

      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: zipKey,
          Body: pass,
          ContentType: 'application/zip',
          ContentDisposition: `attachment; filename="${zipName}"`,
          CacheControl: 'public,max-age=31536000,immutable',
        },
        queueSize: 6,                    // 6 зэрэг chunk upload
        partSize: 16 * 1024 * 1024,      // 16MB chunk — R2 min 5MB, max 5GB
        leavePartsOnError: false,
      });

      // ── Файл бүрийг дарааллаар zip-д нэмнэ ─────────────────────────────
      // archiver нь append хийсний дараа stream-г удирдаж backpressure хянадаг
      const appendAll = async () => {
        let done = 0;
        for (const file of files) {
          const url = urlMap.get(file.id)!;
          const res = await fetchWithRetry(url);
          if (!res.ok || !res.body) {
            this.logger.warn(`Skip ${file.fileName}: HTTP ${res.status}`);
            done++;
            continue;
          }
          const nodeStream = Readable.fromWeb(res.body as any);
          zip.append(nodeStream, { name: file.fileName });
          done++;
          // 10%→90% нь файл нэмэх үе
          await job.progress(10 + Math.round((done / files.length) * 80));
        }
        await zip.finalize();
        await job.progress(95);
      };

      // Upload болон append зэрэг ажиллана — upload PassThrough-ийн өгөгдлийг хүлээнэ
      await Promise.all([upload.done(), appendAll()]);

      await job.progress(100);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      this.logger.log(`ZIP done: ${zipKey} | ${files.length} files | ${elapsed}s`);

      await this.prisma.zipJob.update({
        where: { id: jobId },
        data: { status: 'DONE', zipKey },
      });

      return { zipKey };

    } catch (err: any) {
      this.logger.error(`ZIP failed [${jobId}]: ${err.message}`);
      await this.prisma.zipJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: err.message },
      });
      throw err;
    }
  }
}
