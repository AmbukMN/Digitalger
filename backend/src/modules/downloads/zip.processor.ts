import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as archiver from 'archiver';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { PassThrough } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

export const ZIP_QUEUE = 'zip';

export interface ZipJobPayload {
  jobId: string;
  userId: string;
  productId: string;
  bundleId?: string;
  fileIds: string[];
  zipName: string;
}

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
      });
    } else {
      this.s3 = null;
    }
  }

  @Process({ concurrency: 3 })
  async handleZip(job: Job<ZipJobPayload>) {
    const { jobId, fileIds, zipName } = job.data;

    await this.prisma.zipJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    try {
      const files = await this.prisma.productFile.findMany({
        where: { id: { in: fileIds } },
      });

      if (!files.length) throw new Error('No files found');

      const zipKey = `zips/${jobId}/${zipName}`;

      if (!this.s3) {
        // Dev fallback — just mark done
        await this.prisma.zipJob.update({
          where: { id: jobId },
          data: { status: 'DONE', zipKey },
        });
        return { zipKey };
      }

      // Stream: archiver → PassThrough → R2 multipart upload
      const pass = new PassThrough();
      const zip = archiver.default('zip', { zlib: { level: 1 } });
      zip.pipe(pass);

      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: zipKey,
          Body: pass,
          ContentType: 'application/zip',
        },
        queueSize: 4,       // 4 паралл хэсэг
        partSize: 10 * 1024 * 1024, // 10MB хэсэг
      });

      // Файлуудыг дарааллаар нэмнэ — archiver stream найдвартай байна
      const appendFiles = async () => {
        for (const file of files) {
          const url = await this.storage.getPresignedUrl(file.fileKey, 600, 'get');
          const res = await fetch(url);
          if (!res.ok || !res.body) {
            this.logger.warn(`Skip file ${file.id}: fetch failed`);
            continue;
          }
          const { Readable } = await import('stream');
          const stream = Readable.fromWeb(res.body as any);
          zip.append(stream, { name: file.fileName });
          await job.progress(Math.round((files.indexOf(file) + 1) / files.length * 90));
        }
        await zip.finalize();
      };

      await Promise.all([upload.done(), appendFiles()]);

      await this.prisma.zipJob.update({
        where: { id: jobId },
        data: { status: 'DONE', zipKey },
      });

      this.logger.log(`ZIP done: ${zipKey} (${files.length} files)`);
      return { zipKey };

    } catch (err: any) {
      this.logger.error(`ZIP failed: ${err.message}`);
      await this.prisma.zipJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: err.message },
      });
      throw err;
    }
  }
}
