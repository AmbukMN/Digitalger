import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';

/**
 * R2 key → зургийн URL хөрвүүлэгч.
 *
 * R2_PUBLIC_URL тохируулсан бол CDN-ээс ШУУД (presign-гүй, Cloudflare кэштэй),
 * эс бөгөөс presigned URL (2 цаг, LRU кэштэй).
 *
 * ⚠️ Зөвхөн ЗУРАГ — видео нь эрхийн шалгалттай тул stream module presign ашиглана.
 */
@Injectable()
export class TitleMediaHelper {
  constructor(private readonly storage: StorageService) {}

  async url(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    return this.storage.publicAssetUrl(key, 7200);
  }

  /** Олон key-г зэрэг хөрвүүлнэ (episode poster жагсаалт г.м. — N+1 бус batch) */
  async urlMany(keys: (string | null | undefined)[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((k) => this.url(k)));
  }

  /** Title объект(ууд)-ын key талбаруудыг URL болгож нэмнэ */
  async decorate<T extends { posterKey?: string | null; backdropKey?: string | null }>(
    item: T,
  ): Promise<T & { posterUrl: string | null; backdropUrl: string | null }> {
    const [posterUrl, backdropUrl] = await Promise.all([
      this.url(item.posterKey),
      this.url(item.backdropKey),
    ]);

    // ⚠️ Prisma нь join хүснэгтээр `[{ genre: {...} }]` буцаадаг —
    // frontend-д хэрэглэхэд эвгүй тул хавтгайруулна.
    const raw = (item as { genres?: unknown }).genres;
    const genres = Array.isArray(raw)
      ? raw.map((g) => (g && typeof g === 'object' && 'genre' in g ? (g as { genre: unknown }).genre : g))
      : undefined;

    return { ...item, ...(genres ? { genres } : {}), posterUrl, backdropUrl };
  }

  async decorateMany<T extends { posterKey?: string | null; backdropKey?: string | null }>(
    items: T[],
  ): Promise<(T & { posterUrl: string | null; backdropUrl: string | null })[]> {
    return Promise.all(items.map((i) => this.decorate(i)));
  }
}
