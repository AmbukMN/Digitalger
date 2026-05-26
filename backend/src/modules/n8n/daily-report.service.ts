import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nService } from './n8n.service';

@Injectable()
export class DailyReportService implements OnModuleDestroy {
  private readonly logger = new Logger(DailyReportService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // Өдөр бүр 23:00 Улаанбаатарын цагаар
  @Cron('0 23 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async sendDailyReport(): Promise<void> {
    // Redis distributed lock — олон process-т зөвхөн нэг удаа ажиллуулна
    const lockKey = `cron:daily-report:${new Date().toISOString().split('T')[0]}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', 3600, 'NX').catch(() => null);
    if (!acquired) {
      this.logger.log('Өдрийн тайлан: өөр process аль хэдийн ажиллуулсан — алгасав');
      return;
    }

    this.logger.log('Өдрийн тайлан бэлтгэж байна...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [orders, newUsers] = await Promise.all([
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.PAID,
            createdAt: { gte: today, lt: tomorrow },
          },
          include: {
            items: { include: { product: { select: { id: true, title: true } } } },
          },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: today, lt: tomorrow } },
        }),
      ]);

      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

      // Бүтээгдэхүүн тус бүрийн борлуулалт тоолох
      const productMap = new Map<string, { title: string; count: number; revenue: number }>();
      for (const order of orders) {
        for (const item of order.items) {
          const existing = productMap.get(item.product.id) ?? {
            title: item.product.title,
            count: 0,
            revenue: 0,
          };
          existing.count += 1;
          existing.revenue += Number(item.price);
          productMap.set(item.product.id, existing);
        }
      }

      const topProducts = [...productMap.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      await this.n8n.emitDailyReport({
        date: today.toISOString().split('T')[0],
        totalRevenue,
        orderCount: orders.length,
        newUserCount: newUsers,
        topProducts,
      });

      this.logger.log(`Өдрийн тайлан илгээгдлээ — ₮${totalRevenue.toLocaleString()}, ${orders.length} захиалга`);
    } catch (err) {
      this.logger.error('Өдрийн тайлан алдаа', err);
    }
  }
}
