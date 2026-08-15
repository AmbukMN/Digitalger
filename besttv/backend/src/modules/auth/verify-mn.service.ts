import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * verify.mn MO SMS утас баталгаажуулалтын HTTP клиент.
 *
 * ⚠️⚠️ Энэ нь энгийн OTP БИШ — MO (Mobile Originated) SMS. Бид код
 * ИЛГЭЭДЭГГҮЙ. Хэрэглэгч өөрөө 144773 shortcode руу бидний үүсгэсэн
 * кодыг SMS-ээр илгээнэ. verify.mn тэр SMS-ийн ИЛГЭЭГЧИЙН дугаарыг
 * session-ий дугаартай тааруулна — ингэснээр дугаар нь ҮНЭХЭЭР тухайн
 * хүнийх гэдэг нь батлагдана (OTP-ээс илүү найдвартай: код хулгайлж
 * болох ч өөр дугаараас илгээвэл таарахгүй).
 *
 * Урсгал:
 *   1. `createSession` → POST /sessions (Bearer apiKey)
 *   2. `getSessionStatus` → GET /sessions/{id} (auth ХЭРЭГГҮЙ)
 *
 * ⚠️ apiKey-г ХЭЗЭЭ Ч log хийхгүй.
 */
@Injectable()
export class VerifyMnService {
  private readonly logger = new Logger(VerifyMnService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('verifyMn.apiKey') ?? null;
    /* ⚠️ Сүүлийн `/` хасна — `${base}/sessions` давхар зураас болохоос */
    this.baseUrl = (
      this.config.get<string>('verifyMn.baseUrl') ?? 'https://api.verify.mn'
    ).replace(/\/$/, '');

    if (!this.apiKey) {
      /* ⚠️ Алдаа ШИДЭХГҮЙ — түлхүүргүй ч сервер асах ёстой. Зөвхөн
         утас баталгаажуулах функц ажиллахгүй. */
      this.logger.error(
        'VERIFY_MN_API_KEY тохируулаагүй — утас баталгаажуулалт АЖИЛЛАХГҮЙ',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Session үүсгэнэ — хэрэглэгчид «144773 руу энэ кодыг илгээ» гэсэн
   * заавар буцаана.
   *
   * @param phone нормалчилсан 8 оронтой дугаар
   * @param code  хэрэглэгчийн илгээх 6 оронтой код
   */
  async createSession(
    phone: string,
    code: string,
    callbackUrl?: string | null,
  ): Promise<{
    sessionId: string;
    smsUri: string;
    displayInstruction: string;
    expiresAt: string;
  }> {
    const body = {
      phone,
      text: code,
      ...(callbackUrl ? { callback: callbackUrl } : {}),
      /**
       * ⚠️ ЗААВАЛ ASCII — 160 тэмдэгтэд багтана. Кирилл бичвэл SMS нь
       * UCS-2 болж 70 тэмдэгт болох ба зардал өснө. Баталгаажсаны
       * дараа хэрэглэгчид буцаж очих мессеж.
       */
      responseSms: 'BestTV: Tany utas batalgaajlaa',
    };

    const data = await this.request<{
      sessionId: string;
      phone: string;
      shortcode: string;
      text: string;
      smsUri: string;
      displayInstruction: string;
      expiresAt: string;
    }>('/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return {
      sessionId: data.sessionId,
      smsUri: data.smsUri,
      displayInstruction: data.displayInstruction,
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Session-ий төлөв шалгана.
   *
   * ⚠️⚠️ Ижил sessionId-г 2 СЕКУНД дотор давтан дуудвал verify.mn 429
   * буцаана. Дуудагч polling ≥3 секунд байх ЁСТОЙ.
   * ⚠️ Энэ endpoint нь auth ШААРДАХГҮЙ.
   */
  async getSessionStatus(sessionId: string): Promise<{
    sessionStatus: 'PENDING' | 'VERIFIED' | 'EXPIRED';
    verifiedAt: string | null;
  }> {
    const data = await this.request<{
      sessionId: string;
      sessionStatus: 'PENDING' | 'VERIFIED' | 'EXPIRED';
      verifiedAt?: string | null;
    }>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });

    return {
      sessionStatus: data.sessionStatus,
      verifiedAt: data.verifiedAt ?? null,
    };
  }

  /**
   * fetch + timeout + retry.
   *
   * ⚠️ apiKey/Authorization header-ийг ХЭЗЭЭ Ч log хийхгүй — зөвхөн
   * path/status/body.
   */
  private async request<T>(path: string, init: RequestInit, attempt = 1): Promise<T> {
    if (!this.apiKey) {
      throw new Error('verify.mn тохируулаагүй байна');
    }

    const url = `${this.baseUrl}${path}`;
    const maxAttempts = 3;
    const method = init.method ?? 'GET';

    try {
      /* ⚠️ Timeout ЗААВАЛ — verify.mn удаашрахад хэрэглэгч «боловсруулж
         байна» дээр мөнхөрнө */
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`verify.mn ${method} ${path} → HTTP ${res.status}: ${text}`);
        /* 5xx болон 429 (rate limit) → дахин оролдоно. 4xx → шууд алдаа. */
        const retryable = res.status >= 500 || res.status === 429;
        if (retryable && attempt < maxAttempts) {
          await this.delay(attempt * 1000);
          return this.request<T>(path, init, attempt + 1);
        }
        throw new Error(`verify.mn ${method} ${path} HTTP ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`verify.mn ${method} ${path} → ${msg} (оролдлого ${attempt})`);
      if (attempt < maxAttempts) {
        await this.delay(attempt * 1000);
        return this.request<T>(path, init, attempt + 1);
      }
      throw err;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
