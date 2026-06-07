import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { gzipSync } from 'zlib';
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import { StorageService } from '../../storage/storage.service';
import { N8nService } from '../n8n/n8n.service';

const execAsync = promisify(exec);

@Injectable()
export class BackupService implements OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private readonly redis: Redis;
  private readonly databaseUrl: string | undefined;
  // 30 хоног хадгална, хуучныг автомат устгана (R2-д хадгалагдах тул VPS дискэнд
  // нөлөөгүй; gzip SQL dump жижиг — видео/файл R2-д, DB-д биш).
  private readonly retentionDays = 30;
  private readonly prefix = 'backups/';

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly n8n: N8nService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
    this.databaseUrl = this.config.get<string>('databaseUrl') ?? process.env.DATABASE_URL;
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // Өдөр бүр 04:00 Улаанбаатарын цагаар — DB backup → R2
  @Cron('0 4 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async runDailyBackup(): Promise<void> {
    // Redis distributed lock — олон process-т зөвхөн нэг удаа ажиллуулна
    const date = new Date().toISOString().split('T')[0];
    const lockKey = `cron:db-backup:${date}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', 3600, 'NX').catch(() => null);
    if (!acquired) {
      this.logger.log('DB backup: өөр process аль хэдийн ажиллуулсан — алгасав');
      return;
    }

    if (!this.databaseUrl) {
      this.logger.error('DB backup: DATABASE_URL тохируулаагүй — алгасав');
      await this.n8n
        .emitAlert({
          level: 'critical',
          title: 'DB backup амжилтгүй',
          message: 'DATABASE_URL тохируулаагүй тул өдрийн нөөцлөлт хийгдсэнгүй.',
          source: 'backup',
        })
        .catch(() => {});
      return;
    }

    if (!this.storage.isConfigured()) {
      this.logger.error('DB backup: R2 storage тохируулаагүй — алгасав');
      await this.n8n
        .emitAlert({
          level: 'critical',
          title: 'DB backup амжилтгүй',
          message: 'R2 storage тохируулаагүй тул нөөцлөлт R2 руу хадгалагдсангүй.',
          source: 'backup',
        })
        .catch(() => {});
      return;
    }

    this.logger.log('DB backup эхэлж байна...');

    try {
      // ⚠️ pg_dump backend container-д суусан байх ёстой (postgresql-client).
      // Байхгүй бол доорх exec алдаа гаргана → catch дотор alert (process унахгүй).
      const { stdout, stderr } = await execAsync(`pg_dump "${this.databaseUrl}"`, {
        maxBuffer: 1024 * 1024 * 512, // 512MB хүртэл dump
        windowsHide: true,
      });

      if (!stdout || stdout.length === 0) {
        throw new Error(`pg_dump хоосон үр дүн буцаав. stderr: ${stderr?.slice(0, 500) ?? ''}`);
      }

      const gzipped = gzipSync(Buffer.from(stdout, 'utf8'));
      const key = `${this.prefix}db-${date}.sql.gz`;

      await this.storage.upload(key, gzipped, 'application/gzip');

      const sizeMb = (gzipped.length / 1024 / 1024).toFixed(2);
      this.logger.log(`DB backup амжилттай → ${key} (${sizeMb} MB)`);

      // Хуучин backup (retentionDays-с өмнөх) устгах
      await this.cleanupOldBackups().catch((err) => {
        this.logger.warn(`Хуучин backup цэвэрлэхэд алдаа: ${err?.message ?? err}`);
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      this.logger.error(`DB backup алдаа: ${msg}`);
      await this.n8n
        .emitAlert({
          level: 'critical',
          title: 'DB backup амжилтгүй',
          message: `Өдрийн нөөцлөлт хийх үед алдаа гарлаа: ${msg.slice(0, 300)}`,
          source: 'backup',
        })
        .catch(() => {});
    }
  }

  // R2 доторх backups/ prefix-ийн retentionDays-с хуучин файлуудыг устгах
  private async cleanupOldBackups(): Promise<void> {
    const r2 = this.config.get<any>('r2');
    if (!r2?.accessKeyId || !r2?.secretAccessKey || !r2?.endpoint) return;

    const client = new S3Client({
      region: 'auto',
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    });

    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;

    let continuationToken: string | undefined;
    let deleted = 0;

    do {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: r2.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of list.Contents ?? []) {
        if (!obj.Key || !obj.LastModified) continue;
        if (obj.LastModified.getTime() < cutoff) {
          await client.send(
            new DeleteObjectCommand({ Bucket: r2.bucket, Key: obj.Key }),
          );
          deleted += 1;
          this.logger.log(`Хуучин backup устгав: ${obj.Key}`);
        }
      }

      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);

    if (deleted > 0) {
      this.logger.log(`Нийт ${deleted} хуучin backup устгав (>${this.retentionDays} хоног)`);
    }

    client.destroy();
  }
}
