import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

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

    const command =
      operation === 'put'
        ? new PutObjectCommand({ Bucket: this.bucket, Key: key })
        : new GetObjectCommand({ Bucket: this.bucket, Key: key });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;

    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
