import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

/**
 * BONUM GATEWAY — карт (VISA/Mastercard/UnionPay/Amex), Apple Pay,
 * Google Pay, WeChat Pay-ийн нэгдсэн төлбөрийн зуучлагч.
 *
 * ⚠️⚠️ QPay-Д ОГТ ХАМААГҮЙ — QPay-ийн урсгал (invoice/QR/callback)
 * ХЭВЭЭР, энэ нь зэрэгцээ ШИНЭ зам. Хэрэглэгчид «Bonum» гэсэн нэр
 * ХЭЗЭЭ Ч харагдахгүй (зүгээр «Төлөх»).
 *
 * ⚠️⚠️ DIGITALGER MERCHANT — credential нь DigitalGer дээр бүртгэлтэй
 * тул invoice-ийн item/тайлбарт брэнд нэр ОГТ оруулахгүй, зөвхөн
 * санамсаргүй захиалгын дугаар (QPay-тэй яг ижил зарчим).
 *
 * Урсгал: invoice үүсгэ → followUpLink руу хэрэглэгч шилжинэ (hosted
 * checkout, эмбед боломжгүй) → төлмөгц webhook (x-checksum-v2 HMAC) →
 * эрх нээгдэнэ. Мөн reconcile cron-д invoice status API-г БОЛГООМЖТОЙ
 * (баримтад «production-д бүү түшиглэ» гэсэн тул webhook үндсэн зам).
 */

interface BonumTokenResponse {
  accessToken: string;
  expiresIn: number; // секунд (1800)
  refreshToken?: string;
}

export interface BonumInvoiceResult {
  invoiceId: string;
  followUpLink: string;
}

/** Frontend-ийн method → Bonum providers шүүлт */
export const BONUM_METHOD_PROVIDERS: Record<string, string[]> = {
  /* Карт/Apple/Google бүгд E_COMMERCE hosted хуудсанд гарна */
  card: ['E_COMMERCE'],
  applepay: ['E_COMMERCE'],
  googlepay: ['E_COMMERCE'],
  wechat: ['WE_CHAT'],
};

@Injectable()
export class BonumService {
  private readonly logger = new Logger(BonumService.name);
  /**
   * ⚠️ Token кэш — expiresIn нь СЕКУНД (Bonum баримтаар 1800с).
   * QPay-ийн unix-timestamp гажигтай АНДУУРАХГҮЙ: энд жинхэнэ interval
   * тул Date.now()+сек ашиглана, 60с аюулгүй зайтай.
   */
  private tokenCache: { token: string; expiresAt: number } | null = null;
  /** check API-г хэт олон дуудахаас сэргийлэх (payment тус бүрд 10с) */
  private lastCheckAt = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const c = this.config.get('bonum');
    return !!(c?.appSecret && c?.terminalId && c?.checksumKey && c?.callbackUrl);
  }

  private base(): string {
    return (this.config.get<string>('bonum.baseUrl') ?? 'https://apis.bonum.mn').replace(/\/$/, '');
  }

  /** Access token — кэштэй, 401 үед дуудагч кэш цэвэрлэж дахина */
  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    const c = this.config.get('bonum');
    const res = await fetch(`${this.base()}/bonum-gateway/ecommerce/auth/create`, {
      method: 'POST',
      headers: {
        Authorization: `AppSecret ${c.appSecret}`,
        'X-TERMINAL-ID': String(c.terminalId),
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      this.logger.error(`Bonum token авалт амжилтгүй: ${res.status} ${await res.text()}`);
      throw new BadRequestException('Төлбөрийн систем түр боломжгүй байна');
    }
    const body = (await res.json()) as { data?: BonumTokenResponse } & BonumTokenResponse;
    /* ⚠️ Standard response нь {traceId,status,data} боолттой байж болно —
       data доторхыг эхэлж, шууд талбарыг нөөц болгож уншина */
    const tok = body.data?.accessToken ? body.data : body;
    if (!tok.accessToken) {
      this.logger.error(`Bonum token хариу танигдсангүй: ${JSON.stringify(body).slice(0, 300)}`);
      throw new BadRequestException('Төлбөрийн систем түр боломжгүй байна');
    }
    const ttlSec = Number(tok.expiresIn) > 0 ? Number(tok.expiresIn) : 1800;
    this.tokenCache = { token: tok.accessToken, expiresAt: Date.now() + (ttlSec - 60) * 1000 };
    return tok.accessToken;
  }

  /**
   * Invoice үүсгэх → hosted checkout линк.
   * ⚠️ transactionId = санамсаргүй (захиалгын мөр таамаглагдахгүй);
   *    webhook-ыг INVOICEID-аар тааруулдаг тул энэ нь зөвхөн Bonum-ын
   *    бүртгэлд харагдах дугаар.
   */
  async createInvoice(amount: number, methodKey: string): Promise<BonumInvoiceResult> {
    const c = this.config.get('bonum');
    const providers = BONUM_METHOD_PROVIDERS[methodKey] ?? BONUM_METHOD_PROVIDERS.card;
    const transactionId = randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();

    const invoiceBody = {
      amount,
      callback: c.callbackUrl,
      transactionId,
      /* 24 цаг — QPay PENDING_EXPIRE_HOURS-тай нийцүүлэв */
      expiresIn: 24 * 3600,
      providers,
      /* ⚠️ items/extras ИЛГЭЭХГҮЙ — брэнд нэр, бүтээгдэхүүний мэдээлэл
         DigitalGer merchant-ын бүртгэлд орох ёсгүй */
    };

    const call = async (token: string) =>
      fetch(`${this.base()}/bonum-gateway/ecommerce/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'mn',
        },
        body: JSON.stringify(invoiceBody),
        signal: AbortSignal.timeout(15_000),
      });

    let res = await call(await this.getToken());
    if (res.status === 401 || res.status === 403) {
      this.tokenCache = null;
      res = await call(await this.getToken());
    }
    if (!res.ok) {
      this.logger.error(`Bonum invoice амжилтгүй: ${res.status} ${await res.text()}`);
      /* ⚠️ Invoice амжилтгүй бол Payment бичлэг ҮҮСГЭХГҮЙ (дуудагч талд
         throw — QPay-ийн ижил дүрэм, NULL хог үүсгэхгүй) */
      throw new BadRequestException('Төлбөрийн нэхэмжлэл үүсгэж чадсангүй');
    }

    const body = (await res.json()) as {
      data?: { invoiceId?: string; followUpLink?: string };
      invoiceId?: string;
      followUpLink?: string;
    };
    const data = body.data ?? body;
    if (!data.invoiceId || !data.followUpLink) {
      this.logger.error(`Bonum invoice хариу танигдсангүй: ${JSON.stringify(body).slice(0, 300)}`);
      throw new BadRequestException('Төлбөрийн нэхэмжлэл үүсгэж чадсангүй');
    }
    return { invoiceId: data.invoiceId, followUpLink: data.followUpLink };
  }

  /**
   * Invoice төлөв шалгах — 'PAID' | 'UNPAID' | 'UNKNOWN'.
   *
   * ⚠️ Bonum баримт: «энэ сервисийг PRODUCTION-д бүү түшиглэ» — тиймээс
   * ҮНДСЭН зам нь webhook, энэ нь polling/reconcile-ийн НӨӨЦ. Payment
   * тус бүрд 10 секундэд нэгээс олонгүй дуудна (frontend 3с polling-оос
   * хамгаална). Алдаа/танигдаагүй хариуг UNKNOWN гэж үзнэ (webhook-т
   * итгэх хэвээр).
   */
  async checkInvoice(invoiceId: string): Promise<'PAID' | 'UNPAID' | 'UNKNOWN'> {
    const last = this.lastCheckAt.get(invoiceId) ?? 0;
    if (Date.now() - last < 10_000) return 'UNKNOWN';
    this.lastCheckAt.set(invoiceId, Date.now());
    /* ⚠️ Map хязгааргүй өсөхөөс сэргийлнэ */
    if (this.lastCheckAt.size > 2000) {
      const cutoff = Date.now() - 3600_000;
      for (const [k, v] of this.lastCheckAt) if (v < cutoff) this.lastCheckAt.delete(k);
    }

    try {
      const call = async (token: string) =>
        fetch(`${this.base()}/bonum-gateway/ecommerce/invoices/${encodeURIComponent(invoiceId)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
      let res = await call(await this.getToken());
      if (res.status === 401 || res.status === 403) {
        this.tokenCache = null;
        res = await call(await this.getToken());
      }
      if (!res.ok) return 'UNKNOWN';
      const body = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
      const data = (body.data ?? body) as Record<string, unknown>;
      /* Хариуны бүтэц баримтад бүрэн заагаагүй тул мэдэгдэж буй
         байрлалуудаас status хайна */
      const status = String(
        data.status ?? (data.invoice as Record<string, unknown> | undefined)?.status ?? '',
      ).toUpperCase();
      if (status === 'PAID' || status === 'SUCCESS') return 'PAID';
      if (status) return 'UNPAID';
      return 'UNKNOWN';
    } catch (err) {
      this.logger.warn(`Bonum invoice check алдаа (${invoiceId}): ${String(err)}`);
      return 'UNKNOWN';
    }
  }

  /**
   * Webhook checksum — x-checksum-v2 = HMAC-SHA256(rawBody, CHECKSUM_KEY) hex.
   * ⚠️ timingSafeEqual — timing attack-аас хамгаална (QPay-тэй ижил).
   */
  verifyChecksum(rawBody: string, checksumHeader: string): boolean {
    const key = this.config.get<string>('bonum.checksumKey');
    if (!key || !checksumHeader) return false;
    const expected = createHmac('sha256', key).update(rawBody).digest('hex');
    const a = Buffer.from(expected.toLowerCase());
    const b = Buffer.from(String(checksumHeader).trim().toLowerCase());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
