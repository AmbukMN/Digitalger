import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Verify.mn MO SMS утас баталгаажуулалтын HTTP клиент.
 *
 * ⚠️ Энэ нь энгийн OTP БИШ — MO (Mobile Originated) SMS. Хэрэглэгч өөрөө 144773
 * shortcode руу үүсгэсэн `code`-г SMS-ээр илгээдэг. verify.mn тэр SMS-ийг хүлээн
 * аваад session-ийг VERIFIED болгож, бидэнд callback дохио (эсвэл polling-оор)
 * мэдэгддэг.
 *
 * Урсгал:
 *   1. createSession → POST /sessions (Bearer apiKey). Хэрэглэгчид smsUri/заавар
 *      буцаана (хэрэглэгч 144773 руу кодоо илгээнэ).
 *   2. getSessionStatus → GET /sessions/{id} (auth-гүй). PENDING|VERIFIED|EXPIRED.
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
    this.baseUrl = (
      this.config.get<string>('verifyMn.baseUrl') ?? 'https://api.verify.mn'
    ).replace(/\/$/, '');

    if (!this.apiKey) {
      // Тохиргоо дутуу — loud error (SMS баталгаажуулалт ажиллахгүй).
      this.logger.error(
        'VERIFY_MN_API_KEY тохируулаагүй — утас баталгаажуулалт ажиллахгүй',
      );
    }
  }

  /**
   * Шинэ verify.mn session үүсгэнэ (POST /sessions).
   * @param phone 8-16 оронтой утасны дугаар.
   * @param code  хэрэглэгч 144773 руу илгээх 6 оронтой код.
   * @param callbackUrl verify.mn VERIFIED болоход дуудах URL (sid суулгасан).
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
    if (!this.apiKey) {
      throw new Error('Verify.mn тохируулаагүй (apiKey байхгүй)');
    }

    const body = {
      phone,
      text: code,
      ...(callbackUrl ? { callback: callbackUrl } : {}),
      // ASCII (160 тэмдэгтэд багтана) — баталгаажсаны дараа хэрэглэгчид буцах SMS.
      responseSms: 'DigitalGer: Tany utas batalgaajlaa',
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
   * Session-ий төлвийг шалгана (GET /sessions/{id}). Auth ШААРДАХГҮЙ.
   * ⚠️ Ижил sessionId-г 2с дотор давтан дуудвал verify.mn 429 буцаана — дуудагч
   *    polling ≥3с байх ёстой.
   */
  async getSessionStatus(sessionId: string): Promise<{
    sessionStatus: 'PENDING' | 'VERIFIED' | 'EXPIRED';
    verifiedAt: string | null;
  }> {
    const data = await this.request<{
      sessionId: string;
      phone: string;
      sessionStatus: 'PENDING' | 'VERIFIED' | 'EXPIRED';
      callbackStatus?: string;
      verifiedAt?: string | null;
      expiresAt?: string;
    }>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });

    return {
      sessionStatus: data.sessionStatus,
      verifiedAt: data.verifiedAt ?? null,
    };
  }

  // ─── internal ───────────────────────────────────────────────────────────────

  /**
   * native fetch + AbortController (8с timeout) + retry (нийт 3 оролдлого).
   * (лавлах: n8n.service.ts post()). ⚠️ apiKey/Authorization header-ийг log хийхгүй.
   */
  private async request<T>(
    path: string,
    init: RequestInit,
    attempt = 1,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const maxAttempts = 3; // 1 анхны + 2 retry
    const method = init.method ?? 'GET';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);

      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // ⚠️ apiKey log хийхгүй — зөвхөн path/status/body.
        this.logger.warn(
          `verify.mn ${method} ${path} → HTTP ${res.status}: ${text}`,
        );
        // 5xx болон 429 (rate limit) → retry. 4xx (validation) → шууд алдаа.
        const retryable = res.status >= 500 || res.status === 429;
        if (retryable && attempt < maxAttempts) {
          await this.delay(attempt * 1000);
          return this.request<T>(path, init, attempt + 1);
        }
        throw new Error(`verify.mn ${method} ${path} HTTP ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.logger.warn(`verify.mn ${method} ${path} → timeout (attempt ${attempt})`);
      } else {
        this.logger.warn(
          `verify.mn ${method} ${path} → ${err?.message ?? err} (attempt ${attempt})`,
        );
      }
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
