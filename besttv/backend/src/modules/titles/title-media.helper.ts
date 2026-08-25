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

    /**
     * ⚠️⚠️ ЦУВРАЛЫН БОДИТ СТАТУС — карт дээрх "Бэлтгэж байна" шошго.
     *
     * `Title.streamStatus` нь SERIES-д хэзээ ч READY болдоггүй (видео нь
     * `Episode` дээр). Хэрэглэгч 10/10 анги бэлэн кино дээр "Бэлтгэж
     * байна" гэж уншаад орохгүй өнгөрдөг байв — шууд орлого алдагдана.
     *
     * ⚠️ БҮХ карт энэ функцээр дамждаг тул нэг л энд засахад нүүр,
     * жанр, хайлт, ижил төстэй — бүгд зөв болно (14 дуудлага).
     *
     * ⚠️ Дүрэм: НЭГ Ч анги бэлэн бол үзэж эхлэх боломжтой = READY.
     * Цуврал нь ангиараа гардаг тул "бүгд бэлэн болтол хүлээ" гэж
     * харуулах нь буруу — 1-9 анги бэлэн байхад ч үзэж болно.
     */
    const eps = Array.isArray((item as { seasons?: unknown }).seasons)
      ? ((item as unknown as { seasons: { episodes?: { streamStatus?: string }[] }[] }).seasons ??
          []
        ).flatMap((se) => se.episodes ?? [])
      : null;

    const streamStatus =
      eps && eps.length > 0
        ? eps.some((e) => e.streamStatus === 'READY')
          ? 'READY'
          : eps.some((e) => e.streamStatus === 'PROCESSING')
            ? 'PROCESSING'
            : (eps[0]?.streamStatus ?? 'PENDING')
        : (item as { streamStatus?: string }).streamStatus;

    /* ⚠️ `seasons` нь зөвхөн тооцоонд хэрэгтэй — картад буцаахгүй
       (шаардлагагүй өгөгдөл, JSON-ыг дэмий хөөнө) */
    const { seasons: _drop, ...rest } = item as T & { seasons?: unknown };

    /**
     * ⚠️⚠️ ХАРАГДАХ АНГИЙН ТОО — картад «27 анги» гэж гарна.
     *
     * Хэрэглэгч цуврал хэдэн ангитайг ДАРАХААС ӨМНӨ мэдэх ёстой —
     * 3 ангитай юу, 60 ангитай юу гэдэг нь үзэх шийдвэрт шууд нөлөөлнө.
     *
     * ⚠️ НЭМЭЛТ QUERY ХИЙХГҮЙ: `eps` нь дээр `streamStatus` тооцоход
     *    аль хэдийн татагдсан (`CARD_SELECT.seasons`). Тоолохоос
     *    өөр зардал алга.
     *
     * ⚠️ Нуусан анги/улирал ТООЛОГДОХГҮЙ — `where: { isVisible: true }`
     *    шүүлт query дээр хийгдсэн тул `eps` дотор орж ирэхгүй.
     *
     * ⚠️ 0 бол буцаахгүй (`undefined`) — нэг ангит кино эсвэл анги
     *    ороогүй цувралд «0 анги» гэж харуулах нь утгагүй.
     */
    const episodeCount = eps && eps.length > 0 ? eps.length : undefined;

    return {
      ...(rest as T),
      ...(genres ? { genres } : {}),
      ...(streamStatus !== undefined ? { streamStatus } : {}),
      ...(episodeCount !== undefined ? { episodeCount } : {}),
      posterUrl,
      backdropUrl,
    };
  }

  async decorateMany<T extends { posterKey?: string | null; backdropKey?: string | null }>(
    items: T[],
  ): Promise<(T & { posterUrl: string | null; backdropUrl: string | null })[]> {
    return Promise.all(items.map((i) => this.decorate(i)));
  }
}
