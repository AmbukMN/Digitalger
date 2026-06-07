import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nService } from '../n8n/n8n.service';

@Injectable()
export class MonitorService implements OnModuleDestroy {
  private readonly logger = new Logger(MonitorService.name);
  private readonly redis: Redis;
  // Давтан alert-аас сэргийлэх Redis flag — нэг л удаа alert, сэргэхэд reset
  private readonly alertFlagKey = 'monitor:health:alerting';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly n8n: N8nService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // 5 минут тутамд системийн эрүүл мэндийг шалгана
  // ⚠️ Backend өөрөө унавал энэ cron ажиллахгүй — ГАДНААс uptime monitor
  // (uptimerobot.com үнэгүй эсвэл n8n гадаад health poll) нэмж тавихыг зөвлөнө.
  // Энэ cron нь database/redis тасрахад (backend амьд үед) илрүүлж alert өгнө.
  @Cron('*/5 * * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async checkHealth(): Promise<void> {
    const failed: string[] = [];

    // database — SELECT 1
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      failed.push('database');
      this.logger.warn(`Health: database тасарсан — ${err?.message ?? err}`);
    }

    // redis — ping
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') failed.push('redis');
    } catch (err: any) {
      failed.push('redis');
      this.logger.warn(`Health: redis тасарсан — ${err?.message ?? err}`);
    }

    if (failed.length > 0) {
      await this.handleDegraded(failed);
    } else {
      await this.handleRecovered();
    }
  }

  private async handleDegraded(failed: string[]): Promise<void> {
    // Аль хэдийн alert явсан эсэхийг шалгана — давтан явуулахгүй
    const already = await this.redis.get(this.alertFlagKey).catch(() => null);
    if (already) {
      this.logger.warn(`Health degraded (${failed.join(', ')}) — alert аль хэдийн явсан, алгасав`);
      return;
    }

    // Flag тавина (2 цаг хадгална — сэргэхэд reset хийгдэнэ)
    await this.redis.set(this.alertFlagKey, failed.join(','), 'EX', 7200).catch(() => {});

    await this.n8n
      .emitAlert({
        level: 'critical',
        title: 'Системийн алдаа',
        message: `${failed.join(', ')} холболт тасарсан байна. Яаралтай шалгана уу.`,
        source: 'health',
      })
      .catch(() => {});

    this.logger.error(`Health alert илгээв — тасарсан: ${failed.join(', ')}`);
  }

  private async handleRecovered(): Promise<void> {
    const wasAlerting = await this.redis.get(this.alertFlagKey).catch(() => null);
    if (!wasAlerting) return;

    // Flag-ыг reset — дараагийн алдаанд дахин alert явуулна
    await this.redis.del(this.alertFlagKey).catch(() => {});

    await this.n8n
      .emitAlert({
        level: 'warning',
        title: 'Систем сэргэлээ',
        message: `Өмнө тасарсан үйлчилгээ (${wasAlerting}) хэвийн болов.`,
        source: 'health',
      })
      .catch(() => {});

    this.logger.log('Health сэргэлээ — alert flag reset');
  }
}
