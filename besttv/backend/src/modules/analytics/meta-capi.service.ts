import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { currentSite } from '../../common/site/site-context';
import { siteConfig } from '../../common/site/site-config';

/**
 * META CONVERSIONS API — СЕРВЕР ТАЛААС КОНВЕРСИ ИЛГЭЭХ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (browser pixel хангалтгүй):
 *
 * 1. ДАНСААР ШИЛЖҮҮЛЭХ — админ 1-2 цагийн дараа гараар баталгаажуулдаг.
 *    Тэр үед хэрэглэгчийн browser аль хэдийн хаагдсан тул pixel-ээр
 *    барих боломж ОГТ БАЙХГҮЙ.
 * 2. ХЭТЭВЧЭЭР төлөх нь QPay модалыг тойрдог.
 * 3. iOS 14.5+ болон ad blocker нь browser үйл явдлын 30-50%-ийг
 *    зогсоодог — салбарын хэмжсэн үзүүлэлт.
 *
 * ⚠️ `eventID` — browser болон сервер ХОЁУЛАА нэг худалдан авалтыг
 * илгээж болно. Meta нь энэ ID-аар дедуплекаци хийдэг тул давхар
 * тоологдохгүй. Frontend нь `paymentId`-г eventID болгон илгээдэг тул
 * ЭНД Ч ЯГ ТҮҮНИЙГ ашиглана — өөр утга өгвөл давхардана.
 *
 * ⚠️ Токен байхгүй бол ЧИМЭЭГҮЙ алгасна — аналитик нь нэмэлт боломж,
 * түүнээс болж төлбөрийн урсгал ХЭЗЭЭ Ч зогсох ёсгүй.
 */

/** Meta нь хувийн мэдээллийг SHA-256 hash хэлбэрээр л хүлээж авдаг */
function sha256(v: string): string {
  return createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
}

export interface CapiPurchase {
  /** ⚠️ `paymentId` — frontend-ийн eventID-тэй ЯГ ИЖИЛ байх ёстой */
  eventId: string;
  email?: string | null;
  phone?: string | null;
  value: number;
  /** Багцын нэр эсвэл киноны нэр */
  contentName?: string | null;
  kind?: 'plan' | 'rental' | 'topup';
  /** Хэрэглэгч төлбөрөө хийсэн хуудас */
  sourceUrl?: string;
}

@Injectable()
export class MetaCapiService {
  private readonly logger = new Logger(MetaCapiService.name);

  /**
   * ⚠️⚠️ META PIXEL — САЙТ БҮРД ӨӨР.
   *
   * Урьд нь `readonly` талбар байсан (constructor-т нэг удаа).
   * Нэг backend хоёр сайт үйлчилдэг тул getter болгов:
   *
   *   besttv   → META_PIXEL_ID          (ХУУЧИН env, зан төлөв ХЭВЭЭР)
   *   bestfilm → BESTFILM_META_PIXEL_ID
   *
   * ⚠️ ЯАГААД ЧУХАЛ ВЭ: pixel нь СУРТАЛЧИЛГААНЫ данстай холбоотой.
   * Нэг pixel хуваалцвал BestFilm-ийн худалдан авалт BestTV-ийн
   * кампанит ажлын үр дүнд бүртгэгдэж, зар сурталчилгааны төсвийг
   * БУРУУ хуваарилна.
   *
   * ⚠️ Тохируулаагүй бол ЧИМЭЭГҮЙ алгасна (`isConfigured` false) —
   * сайт унахгүй.
   */
  private env(key: string): string {
    const prefix = currentSite() === 'besttv' ? '' : 'BESTFILM_';
    return (process.env[`${prefix}${key}`] ?? '').trim();
  }

  private get pixelId(): string {
    return this.env('META_PIXEL_ID');
  }
  private get token(): string {
    return this.env('META_CAPI_TOKEN');
  }
  /** ⚠️ Үйл явдлын эх сурвалж URL — сайтын ӨӨРИЙН домэйн */
  private get siteUrl(): string {
    return siteConfig().url;
  }

  constructor(private readonly config: ConfigService) {
    /* ⚠️ Логд ЗӨВХӨН BestTV-ийнхийг харуулна — эхлэх үед контекст
       байхгүй тул `currentSite()` нь besttv буцаана. */
    const hasBesttv = Boolean(
      process.env.META_PIXEL_ID?.trim() && process.env.META_CAPI_TOKEN?.trim(),
    );
    const hasBestfilm = Boolean(
      process.env.BESTFILM_META_PIXEL_ID?.trim() &&
        process.env.BESTFILM_META_CAPI_TOKEN?.trim(),
    );
    this.logger.log(
      `Meta CAPI — besttv: ${hasBesttv ? 'бэлэн' : 'тохируулаагүй'}, ` +
        `bestfilm: ${hasBestfilm ? 'бэлэн' : 'тохируулаагүй'}`,
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.pixelId && this.token);
  }

  /**
   * Худалдан авалт илгээх.
   *
   * ⚠️ ХЭЗЭЭ Ч throw хийхгүй — дуудагч тал `void` хийж болно.
   */
  async purchase(p: CapiPurchase): Promise<void> {
    if (!this.isConfigured) return;

    /**
     * ⚠️ Утасны дугаарыг ОЛОН УЛСЫН форматаар — Meta нь `976` кодгүй
     * дугаарыг таньдаггүй тул тааруулалт (match rate) унана.
     */
    const phone = p.phone?.replace(/\D/g, '');
    const phoneIntl = phone
      ? phone.startsWith('976')
        ? phone
        : `976${phone}`
      : null;

    const userData: Record<string, string[]> = {};
    if (p.email) userData.em = [sha256(p.email)];
    if (phoneIntl) userData.ph = [sha256(phoneIntl)];

    /**
     * ⚠️ `user_data` ХООСОН байвал Meta нь үйл явдлыг хүлээж авах ч
     * ХЭНД Ч тааруулж чадахгүй — реклам оновчлолд үнэ цэнэгүй.
     * Тиймээс имэйл ч, утас ч байхгүй бол илгээхгүй.
     */
    if (!Object.keys(userData).length) {
      this.logger.warn(`CAPI алгасав — хэрэглэгчийн мэдээлэлгүй (${p.eventId})`);
      return;
    }

    const body = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          /* ⚠️ Browser-ийнхтэй ИЖИЛ ID — дедуплекаци үүнээс хамаарна */
          event_id: p.eventId,
          action_source: 'website',
          event_source_url: p.sourceUrl ?? this.siteUrl,
          user_data: userData,
          custom_data: {
            value: p.value,
            currency: 'MNT',
            content_type: p.kind === 'rental' ? 'product' : 'product_group',
            content_ids: [p.eventId],
            content_name: p.contentName ?? undefined,
            /* Browser-ийнхтэй ижил — тайланд ялгахад хэрэгтэй */
            site: 'besttv',
          },
        },
      ],
    };

    try {
      /* ⚠️ 8 секунд — Meta удаашрахад төлбөрийн урсгал хүлээх ёсгүй */
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8_000);

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${this.pixelId}/events?access_token=${encodeURIComponent(this.token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        },
      ).finally(() => clearTimeout(timer));

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.logger.warn(`CAPI ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      this.logger.log(`CAPI Purchase илгээв — ${p.eventId} (${p.value}₮)`);
    } catch (e) {
      /* ⚠️ Аналитик унасан нь төлбөрийг ХЭЗЭЭ Ч зогсоох ёсгүй */
      this.logger.warn(`CAPI илгээж чадсангүй (${p.eventId}): ${String(e).slice(0, 150)}`);
    }
  }
}
