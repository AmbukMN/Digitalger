import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * Public read endpoint-уудын Redis cache helper.
 *
 * Зорилго: menu/settings/categories/product-types зэрэг ХҮСЭЛТ БҮРД DB-ээс
 * уншигддаг, ховор өөрчлөгддөг өгөгдлийг Redis-д кэшлэж хариуг хурдасгана.
 * Cache унавал (Redis алга/алдаа) шууд factory-г дуудна — fail-open тул хэзээ ч
 * хариу алдагдахгүй. Admin өөрчлөлт хийхэд тухайн key-г del хийж шинэчилнэ.
 */
@Injectable()
export class AppCacheService {
  private readonly logger = new Logger(AppCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /** Cache-аас уншина; байхгүй бол factory дуудаж кэшлээд буцаана. */
  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.cache.get<T>(key);
      if (cached !== undefined && cached !== null) return cached;
    } catch (e) {
      this.logger.warn(`cache get failed (${key}): ${(e as Error).message}`);
    }

    const fresh = await factory();

    try {
      await this.cache.set(key, fresh, ttlMs);
    } catch (e) {
      this.logger.warn(`cache set failed (${key}): ${(e as Error).message}`);
    }

    return fresh;
  }

  /** Нэг буюу хэд хэдэн key-г cache-аас устгана (admin өөрчлөлтийн дараа). */
  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.cache.del(key);
      } catch (e) {
        this.logger.warn(`cache del failed (${key}): ${(e as Error).message}`);
      }
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
