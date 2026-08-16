import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CacheService } from '../../common/cache/cache.service';
import { ServerStatsService } from './server-stats.service';

/** Load balancer/orchestrator monitoring-д зориулсан health check */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const dbOk = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'up' : 'down',
    };
  }
}

/**
 * Серверийн LIVE хяналт — зөвхөн админд.
 *
 * ⚠️⚠️ `@Roles(ADMIN)` ЗААВАЛ. Серверийн нөөц, хувилбар, uptime нь
 * халдлагад хэрэгтэй мэдээлэл (ямар ачаалалд унахыг, ямар Node
 * хувилбарын эмзэг байдал байгааг харуулна). Нийтэд задлах ёсгүй.
 */
@Controller('admin/server')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ServerInsightController {
  constructor(
    private readonly stats: ServerStatsService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get('stats')
  async serverStats() {
    /**
     * ⚠️ Үйлчилгээний эрүүл байдлыг ХЭМЖИНЭ (зөвхөн «ажиллаж байна»
     * гэхгүй) — удаашрал нь бүрэн унахаас ӨМНӨ мэдэгддэг эрт дохио.
     *
     * ⚠️ Бүгд `Promise.all` — дараалан шалгавал 3 үйлчилгээний
     * хоцролт нэмэгдэнэ.
     */
    const [system, db, redis] = await Promise.all([
      this.stats.collect(),
      this.pingDb(),
      this.pingRedis(),
    ]);

    return {
      system,
      services: { database: db, redis },
    };
  }

  /** PostgreSQL — хариу өгөх ХУГАЦААГ хэмжинэ */
  private async pingDb(): Promise<{ up: boolean; latencyMs: number | null }> {
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { up: true, latencyMs: Date.now() - t0 };
    } catch {
      return { up: false, latencyMs: null };
    }
  }

  /**
   * Redis — бичих/унших мөчлөгөөр шалгана.
   *
   * ⚠️ Зөвхөн `get` хийвэл Redis УНТАРСАН ч `null` буцаад «ажиллаж
   * байна» мэт харагдана (CacheService нь алдааг залгидаг). Тиймээс
   * бичээд буцааж уншиж ТУЛГАНА.
   */
  private async pingRedis(): Promise<{ up: boolean; latencyMs: number | null }> {
    const t0 = Date.now();
    const key = 'health:ping';
    const val = String(t0);
    try {
      await this.cache.set(key, val, 10);
      const got = await this.cache.get<string>(key);
      return { up: got === val, latencyMs: Date.now() - t0 };
    } catch {
      return { up: false, latencyMs: null };
    }
  }
}

@Module({
  controllers: [HealthController, ServerInsightController],
  providers: [ServerStatsService],
})
export class HealthModule {}
