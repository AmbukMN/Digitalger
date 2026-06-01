import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Public read endpoint-уудын Redis cache helper (ioredis дээр шууд суурилсан).
 *
 * Зорилго: menu/settings/categories/product-types/suggested зэрэг ХҮСЭЛТ БҮРД
 * DB-ээс уншигддаг, ховор өөрчлөгддөг өгөгдлийг Redis-д кэшлэж хариуг хурдасгана.
 *
 * Яагаад cache-manager биш ioredis: cache-manager v7 нь cache-manager-redis-yet-тэй
 * нийцэхгүй чимээгүй memory store руу унадаг (Redis-д бичигддэггүй). ioredis-ийг
 * шууд ашигласнаар бодит Redis cache (restart-д хадгалагдах, олон instance хуваалцах)
 * баталгаатай. Redis алга/алдаа бол factory-г шууд дуудна — fail-open, хариу алдагдахгүй.
 */
@Injectable()
export class AppCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly redis: Redis;
  private readonly prefix = 'cache:';

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`redis connect failed: ${(e as Error).message}`);
    });
    this.redis.on('error', (e) => {
      // Чимээгүй — fail-open. Алдаа бүрд лог хийхгүй (давтагдахаас сэргийлнэ).
      this.logger.debug(`redis error: ${e.message}`);
    });
  }

  /** Cache-аас уншина; байхгүй бол factory дуудаж кэшлээд буцаана. */
  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const fullKey = this.prefix + key;
    try {
      const cached = await this.redis.get(fullKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Redis унасан — factory руу шилжинэ (fail-open)
    }

    const fresh = await factory();

    try {
      await this.redis.set(fullKey, JSON.stringify(fresh), 'PX', ttlMs);
    } catch {
      // Бичиж чадсангүй — хариу буцаахад нөлөөлөхгүй
    }

    return fresh;
  }

  /** Нэг буюу хэд хэдэн key-г cache-аас устгана (admin өөрчлөлтийн дараа). */
  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.redis.del(...keys.map((k) => this.prefix + k));
    } catch {
      // Redis унасан — TTL дээр түшиглэнэ (хамгийн муудаа ttl хүртэл хуучин утга)
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      /* ignore */
    }
  }
}

/** Cache key-уудын төв жагсаалт — нэг л газраас удирдана. */
export const CacheKeys = {
  publicSettings: 'public:settings',
  productTypes: 'public:product-types',
  publicMenu: 'public:menu',
  categories: 'public:categories',
} as const;
