import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis кэш — үнэтэй асуулгын үр дүнг хэсэг хугацаанд хадгална.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: Redis нь төсөлд БullMQ-д ЗӨВХӨН queue-д
 * хэрэглэгдэж байсан. Нүүр хуудас нь хүсэлт бүрд 6 их асуулга
 * (banner + шинэ + удахгүй + БҮХ жанр × 20 кино + top10) хийдэг бөгөөд
 * энэ нь хамгийн их зочилдог хуудас. 1000 зэрэг зочин = 6000 асуулга.
 *
 * ⚠️ КЭШ УНАСАН Ч САЙТ АЖИЛЛАНА: бүх метод алдааг залгиж, кэшгүй мэт
 * ажиллана (`get` → null, `wrap` → шууд тооцно). Redis унтарсан үед
 * нүүр хуудас цагаан болох нь ХАМААГҮЙ дор.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('redisUrl');
    if (!url) {
      this.logger.warn('REDIS_URL байхгүй — кэш идэвхгүй (сайт хэвийн ажиллана)');
      this.redis = null;
      return;
    }
    this.redis = new Redis(url, {
      keyPrefix: 'besttv:cache:',
      /**
       * ⚠️ `maxRetriesPerRequest: 1` — кэш нь ЧУХАЛ БИШ. Redis удвал
       * хүсэлтийг гацаахын оронд хурдан бууж, DB рүү шууд очих нь дээр.
       */
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    /* ⚠️ Алдаа сонсохгүй бол ioredis нь process-ыг унагаана */
    this.redis.on('error', (e) => this.logger.warn(`Redis кэш алдаа: ${e.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /** @param ttlSec — хэдэн секунд хадгалах */
  async set(key: string, value: unknown, ttlSec: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch {
      /* ⚠️ Кэш бичиж чадаагүй нь алдаа БИШ — дараагийн удаа дахин оролдоно */
    }
  }

  /**
   * WARN ATOMIC take - read the value AND delete it in one step.
   *
   * For one-time tokens (download tickets). `get` then `del` would let
   * two concurrent requests both read the value before either deletes
   * it, so the ticket would work twice. `GETDEL` closes that window.
   *
   * @returns the value, or null if absent / Redis unavailable
   */
  async take<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      /* GETDEL needs Redis 6.2+; fall back to a MULTI if unsupported */
      const raw = await this.redis
        .getdel(key)
        .catch(async () => {
          const res = await this.redis!.multi().get(key).del(key).exec();
          return (res?.[0]?.[1] as string | null) ?? null;
        });
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /** Redis бодитоор холбогдсон эсэх — fallback шийдэхэд хэрэгтэй */
  get isReady(): boolean {
    return this.redis !== null;
  }

  /**
   * Кэшээс уншина, байхгүй бол `fn()` ажиллуулж хадгална.
   *
   * ⚠️ Санамсаргүй нэг зэрэг олон хүсэлт ирвэл `fn` хэд хэдэн удаа
   * ажиллаж болно (cache stampede). Нүүр хуудсанд энэ нь хүлээн
   * зөвшөөрөгдөх — түгжээ нэмбэл нарийсаж, ашиг нь бага.
   */
  async wrap<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await fn();
    await this.set(key, value, ttlSec);
    return value;
  }

  /**
   * Загвараар устгах — контент өөрчлөгдөхөд кэшийг ЗААВАЛ цэвэрлэнэ.
   *
   * ⚠️ Админ кино нэмэх/засахад нүүрний кэш хуучин хэвээр үлдвэл
   * "нэмсэн кино харагдахгүй байна" гэсэн гомдол гарна.
   * ⚠️ `SCAN` ашиглана — `KEYS` нь Redis-ийг БҮТЭН блоклодог.
   */
  async invalidate(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const full = `besttv:cache:${pattern}`;
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', full, 'COUNT', 200);
        cursor = next;
        /* ⚠️ keyPrefix нь `del`-д ДАХИН нэмэгддэг тул урьдчилж хасна */
        if (keys.length) {
          await this.redis.del(...keys.map((k) => k.replace('besttv:cache:', '')));
        }
      } while (cursor !== '0');
    } catch (e) {
      this.logger.warn(`Кэш цэвэрлэж чадсангүй (${pattern}): ${String(e)}`);
    }
  }

  /**
   * Тоолуур нэмэх — `views` зэрэг олон бичилттэй утгад.
   * @returns шинэ утга, эсвэл Redis байхгүй бол null
   */
  async incr(key: string, ttlSec: number): Promise<number | null> {
    if (!this.redis) return null;
    try {
      const v = await this.redis.incr(key);
      if (v === 1) await this.redis.expire(key, ttlSec);
      return v;
    } catch {
      return null;
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
