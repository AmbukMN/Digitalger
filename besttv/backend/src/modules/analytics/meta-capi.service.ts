import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

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
  private readonly pixelId: string;
  private readonly token: string;
  private readonly siteUrl: string;

  constructor(private readonly config: ConfigService) {
    this.pixelId = this.config.get<string>('META_PIXEL_ID')?.trim() ?? '';
    this.token = this.config.get<string>('META_CAPI_TOKEN')?.trim() ?? '';
    this.siteUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://besttv.us';

    if (this.pixelId && this.token) {
      this.logger.log(`Meta Conversions API бэлэн — pixel ${this.pixelId}`);
    } else {
      this.logger.warn('META_PIXEL_ID/META_CAPI_TOKEN алга — CAPI илгээхгүй');
    }
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
