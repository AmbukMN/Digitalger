import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CacheService } from '../../common/cache/cache.service';

/**
 * Cloudflare R2 зай эзлэлтийн шинжилгээ — кино тус бүр хэдэн GB эзэлж
 * байгааг харуулна.
 *
 * ⚠️⚠️ ЯАГААД КЭШТЭЙ ВЭ:
 * R2-ийн `ListObjectsV2` нь 1000-аар хуудаслаж бүх объектыг тоолдог.
 * HLS видео нь сегмент бүрээрээ тусдаа объект (нэг кино = 500-2000 файл)
 * тул нийт объект хэдэн арван мянга болно. Админ хуудас нээх бүрт бүрэн
 * скан хийвэл:
 *   - 10-30 секунд хүлээнэ (dashboard "гацсан" мэт)
 *   - R2 Class B үйлдлийн төлбөр нэмэгдэнэ
 * Тиймээс үр дүнг 10 минут кэшилнэ. `?refresh=1`-ээр албадан шинэчилнэ.
 */

/** Кэш хадгалах хугацаа */
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Redis түлхүүр — процессын санах ойгоос ГАДНА (restart даана) */
const CACHE_KEY = 'storage:usage:v1';

/** Хэмжээ хэтэрсэн үед сэрэмжлүүлэх босго (R2 үнэгүй багц = 10GB) */
const FREE_TIER_GB = 10;

export interface TitleUsage {
  id: string;
  title: string;
  type: string;
  slug: string;
  /** Нийт байт */
  bytes: number;
  /** Задаргаа — юу нь их зай эзэлж байгааг харна */
  breakdown: { video: number; trailer: number; images: number; raw: number };
  /** Файлын тоо (HLS segment бүр тусдаа) */
  objects: number;
}

export interface UsageResult {
  totalBytes: number;
  totalObjects: number;
  /** Ямар нэг кинотой холбогдоогүй үлдэгдэл (аватар, баннер, orphan) */
  unassignedBytes: number;
  byCategory: { video: number; trailer: number; images: number; raw: number; other: number };
  titles: TitleUsage[];
  freeTierGb: number;
  usedPercentOfFreeTier: number;
  /** Кэш хэзээ шинэчлэгдсэн (ISO) */
  computedAt: string;
  cached: boolean;
}

@Injectable()
export class StorageUsageService {
  private readonly logger = new Logger(StorageUsageService.name);
  private cache: { at: number; data: UsageResult } | null = null;
  /** Зэрэг ирсэн хүсэлтүүд НЭГ л скан хуваалцана (R2 дуудлага хэмнэнэ) */
  private inflight: Promise<UsageResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    /* ⚠️ Redis кэш — процессын санах ой restart-д алга болдог (@Global) */
    private readonly appCache: CacheService,
  ) {}

  /**
   * ⚠️⚠️ УРЬДЧИЛЖ ТООЦНО — админ ХЭЗЭЭ Ч ХҮЛЭЭХГҮЙ.
   *
   * Скан нь 98 СЕКУНД болдог (93,491 объект). Кэш хугацаа дуусмагц
   * ДАРААГИЙН админ тэр бүхнийг хүлээх ба proxy таймаут цохино
   * (логонд 22 удаа `socket hang up` гарсан).
   * 8 минут тутам урьдчилж шинэчилснээр кэш ХЭЗЭЭ Ч хоосрохгүй
   * (TTL 10 мин > 8 мин интервал).
   *
   * ⚠️ Дэвсгэрт ажиллана — HTTP хүсэлт хүлээлгэхгүй.
   */
  @Cron('*/8 * * * *')
  async warmCache() {
    try {
      await this.usage(true);
    } catch (e) {
      /* ⚠️ Cron унасан нь админ хуудсыг эвдэх ёсгүй — хуучин кэш үлдэнэ */
      this.logger.warn(`Storage кэш урьдчилан тооцоолж чадсангүй: ${String(e)}`);
    }
  }

  async usage(refresh = false): Promise<UsageResult> {
    if (!refresh && this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return { ...this.cache.data, cached: true };
    }

    /**
     * ⚠️⚠️ REDIS КЭШ — процессын санах ой BACKEND RESTART-Д АЛГА БОЛНО.
     *
     * Бодит алдаа: deploy хийсний дараа админ storage хуудас нээхэд
     * `socket hang up` (22 удаа логонд). Скан нь 98 СЕКУНД болдог
     * (93,491 объект / 94 хуудас) тул proxy таймаут цохидог.
     * Redis-д хадгалснаар restart-ын дараа ч шууд хариу өгнө.
     */
    if (!refresh) {
      const hit = await this.appCache.get<UsageResult>(CACHE_KEY);
      if (hit) {
        this.cache = { at: Date.now(), data: hit };
        return { ...hit, cached: true };
      }
    }

    /**
     * ⚠️⚠️ ХУГАЦАА ХЭТЭРСЭН ДАТАГ ШУУД буцаана, шинэчлэлт нь ДЭВСГЭРТ.
     *
     * Эс бөгөөс кэш хоосорсон эхний хүсэлт 98 секунд хүлээж таймаут
     * болно. Бага зэрэг хуучин тоо нь ГАЦСАН хуудаснаас ХАМААГҮЙ дээр
     * (зай эзэлхүүн 10 минутад мэдэгдэхүйц өөрчлөгддөггүй).
     */
    if (this.cache) {
      const stale = this.cache.data;
      this.inflight ??= this.compute().finally(() => (this.inflight = null));
      void this.inflight.catch(() => null);
      return { ...stale, cached: true };
    }

    this.inflight ??= this.compute().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async compute(): Promise<UsageResult> {
    const started = Date.now();

    const [objects, titles, episodes] = await Promise.all([
      this.storage.listAllKeys(),
      this.prisma.title.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          videoKey: true,
          videoRawKey: true,
          trailerKey: true,
          posterKey: true,
          backdropKey: true,
          galleryKeys: true,
        },
      }),
      // ⚠️ Episode нь Title-тай ШУУД холбогддоггүй — Season дамжина
      this.prisma.episode.findMany({
        select: {
          videoKey: true,
          videoRawKey: true,
          posterKey: true,
          season: { select: { titleId: true } },
        },
      }),
    ]);

    /**
     * ⚠️ HLS видео нь `movies/<id>/hls/master.m3u8` гэх мэт байдаг ба ТЭР
     * ХАВТАС доторх segment бүр тусдаа объект. Тиймээс key-г ЯГ таарлаар
     * биш, ХАВТСААР нь тоолно — эс бөгөөс зөвхөн m3u8-ийн хэдэн KB л
     * тоологдож, бодит хэдэн GB алдагдана.
     */
    const dirOf = (key?: string | null) => {
      if (!key) return null;
      const i = key.lastIndexOf('/');
      return i > 0 ? key.slice(0, i + 1) : null;
    };

    /** prefix → {titleId, kind} */
    const prefixMap: { prefix: string; titleId: string; kind: keyof TitleUsage['breakdown'] }[] = [];
    /** яг таарах key → {titleId, kind} */
    const exactMap = new Map<string, { titleId: string; kind: keyof TitleUsage['breakdown'] }>();

    const addPrefix = (key: string | null | undefined, titleId: string, kind: keyof TitleUsage['breakdown']) => {
      const d = dirOf(key);
      if (d) prefixMap.push({ prefix: d, titleId, kind });
    };
    const addExact = (key: string | null | undefined, titleId: string, kind: keyof TitleUsage['breakdown']) => {
      if (key) exactMap.set(key, { titleId, kind });
    };

    const usage = new Map<string, TitleUsage>();
    for (const t of titles) {
      usage.set(t.id, {
        id: t.id,
        title: t.title,
        slug: t.slug,
        type: t.type,
        bytes: 0,
        objects: 0,
        breakdown: { video: 0, trailer: 0, images: 0, raw: 0 },
      });
      addPrefix(t.videoKey, t.id, 'video');
      addPrefix(t.trailerKey, t.id, 'trailer');
      addExact(t.videoRawKey, t.id, 'raw');
      addExact(t.posterKey, t.id, 'images');
      addExact(t.backdropKey, t.id, 'images');
      for (const g of t.galleryKeys ?? []) addExact(g, t.id, 'images');
    }
    for (const e of episodes) {
      const titleId = e.season?.titleId;
      if (!titleId || !usage.has(titleId)) continue; // цуврал устсан бол алгасна
      addPrefix(e.videoKey, titleId, 'video');
      addExact(e.videoRawKey, titleId, 'raw');
      addExact(e.posterKey, titleId, 'images');
    }

    // ⚠️ Урт prefix эхэнд — давхцвал ХАМГИЙН ТОДОРХОЙ нь ялна
    prefixMap.sort((a, b) => b.prefix.length - a.prefix.length);

    let totalBytes = 0;
    let unassignedBytes = 0;
    const byCategory = { video: 0, trailer: 0, images: 0, raw: 0, other: 0 };

    for (const o of objects) {
      const size = o.size ?? 0;
      totalBytes += size;

      const exact = exactMap.get(o.key);
      const hit = exact ?? prefixMap.find((p) => o.key.startsWith(p.prefix));

      if (!hit) {
        unassignedBytes += size;
        byCategory.other += size;
        continue;
      }
      const u = usage.get(hit.titleId);
      if (!u) {
        unassignedBytes += size;
        byCategory.other += size;
        continue;
      }
      u.bytes += size;
      u.objects += 1;
      u.breakdown[hit.kind] += size;
      byCategory[hit.kind] += size;
    }

    const list = [...usage.values()].filter((u) => u.bytes > 0).sort((a, b) => b.bytes - a.bytes);

    const result: UsageResult = {
      totalBytes,
      totalObjects: objects.length,
      unassignedBytes,
      byCategory,
      titles: list,
      freeTierGb: FREE_TIER_GB,
      usedPercentOfFreeTier: Math.round((totalBytes / (FREE_TIER_GB * 1024 ** 3)) * 100),
      computedAt: new Date().toISOString(),
      cached: false,
    };

    this.cache = { at: Date.now(), data: result };
    /* ⚠️ Redis-д ч хадгална — backend restart-ыг даана (дээрх тайлбар) */
    void this.appCache.set(CACHE_KEY, result, CACHE_TTL_MS / 1000);
    this.logger.log(
      `R2 скан: ${objects.length} объект, ${(totalBytes / 1024 ** 3).toFixed(2)} GB, ${Date.now() - started}мс`,
    );
    return result;
  }
}
