import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { PrismaService } from '../../prisma/prisma.service';
import { signUnsubscribe } from '../../common/unsub-token';

/**
 * SES-ийн ТҮР зуурын алдаанууд — эдгээрт л дахин оролдоно.
 * ⚠️ Permanent алдаанд (буруу хаяг, MessageRejected) retry хийвэл SES-ийн
 * reputation муудаж, бүх имэйл блоклогдох эрсдэлтэй.
 */
const TRANSIENT = new Set([
  'Throttling',
  'ThrottlingException',
  'TooManyRequestsException',
  'ServiceUnavailable',
  /* ⚠️ DigitalGer-ээс нөхсөн 3 нэр — эдгээр дутуу байсан тул түр
     саатлыг permanent гэж андуурч имэйл ЧИМЭЭГҮЙ алдагддаг байв */
  'ServiceUnavailableException',
  'RequestTimeoutException',
  'ENOTFOUND',
  'InternalFailure',
  'RequestTimeout',
  'TimeoutError',
  'NetworkingError',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);
const MAX_ATTEMPTS = 3;

export type EmailTemplate =
  | 'welcome'
  | 'verify'
  | 'payment'
  | 'subscription'
  | 'rental'
  /** Багц дуусах сануулга (хоногоор) */
  | 'expiring'
  /** ⚠️ Түрээс дуусах сануулга — `expiring`-ЭЭС ТУСДАА: давхар илгээхээс
   *  сэргийлэх `EmailLog` шалгалт нь `template`-ээр ялгадаг тул нэг нэр
   *  хэрэглэвэл багцын сануулга ирсэн хүнд түрээсийнх очихгүй болно. */
  | 'rental-expiring'
  /** ⚠️ Нууц үг сэргээх линк — `verify`-ЭЭС ТУСДАА: EmailLog-оор хайхад
   *  "хэн нууц үгээ сэргээх гэж оролдсон" гэдгийг тусад нь мөрдөх
   *  шаардлагатай (аюулгүй байдлын мөрдлөг). */
  | 'password-reset'
  /** Нууц үг АМЖИЛТТАЙ солигдсоны мэдэгдэл (халдлага илрүүлэх сануулга) */
  | 'password-changed'
  | 'marketing'
  /** WARN Unsubscribe request that arrived WITHOUT a valid signature -
   *  we mail a signed link instead of trusting the request. Separate
   *  template so admins can see these attempts in EmailLog. */
  | 'unsubscribe-confirm'
  /** WARN QPay QR generated but never paid - a nudge 2h later.
   *  Separate template so EmailLog can dedupe and admins can measure
   *  how much of the 29% abandon rate this recovers. */
  | 'payment-abandoned'
  /**
   * ─── АМЬДРАЛЫН МӨЧЛӨГИЙН (re-engagement) ИМЭЙЛҮҮД ────────────────
   *
   * ⚠️⚠️ ТУС БҮР ТУСДАА ТӨРӨЛТЭЙ БАЙХ ЁСТОЙ. Бүгдийг `marketing`
   * гэж нэрлэвэл `EmailLog`-оор давхардал шалгах боломжгүй болно:
   * win-back авсан хүнд «багц аваарай» гэсэн имэйл дахин очиж,
   * эсрэгээрээ ч болно. Мөн админ аль урсгал үр дүнтэйг мэдэхгүй.
   */
  /** Багц дуусаад 3 хоног — эргэж ирэхийг урих (купонтой) */
  | 'winback-3d'
  /** Багц дуусаад 14 хоног — сүүлийн санал (илүү өндөр хямдрал) */
  | 'winback-14d'
  /** Бүртгүүлээд 3 хоног болсон ч багц аваагүй */
  | 'no-purchase-3d'
  /** Үнэгүй контент үзсэн ч багц аваагүй */
  | 'watched-no-plan'
  /** Багцтай атлаа 30 хоног нэвтрээгүй — шинэ контент санал болгох */
  | 'inactive-30d'
  /** Хэтэвчинд мөнгө байгаа ч зарцуулаагүй */
  | 'wallet-idle'
  /** Дуусгаагүй кино сануулах */
  | 'unfinished';

/**
 * Имэйл илгээх сервис (AWS SES).
 *
 * ⚠️ Дизайны шийдэл — DigitalGer-ийн батлагдсан загвараас:
 *   1. Дараалал (queue) — SES-ийн секундын хязгаарт цохиулахгүй, 300ms зайтай
 *   2. Suppression — bounce/complaint ирсэн хаяг руу ДАХИН ИЛГЭЭХГҮЙ
 *   3. Зөвхөн transient алдаанд retry (exponential backoff)
 *   4. Бүх template НЭГ layout — table-based (бүх email client дэмжинэ)
 *   5. Илгээлт бүр EmailLog-д бичигдэнэ (админ хяналт)
 *
 * ⚠️ Зочны хаяг (@guest.besttv.mn) руу ХЭЗЭЭ Ч илгээхгүй.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly ses: SESClient | null;

  /**
   * ⚠️⚠️ ИМЭЙЛ ИЛГЭЭХ БОЛОМЖТОЙ ЭСЭХ — эрүүл мэндийн шалгалтад.
   *
   * БОДИТ АСУУДАЛ: AWS түлхүүр `.env`-ээс алга болоход систем
   * ЧИМЭЭГҮЙ ажилласаар байв — зөвхөн startup дээр нэг `warn` мөр
   * гарч, дараа нь имэйл бүр `failed` гэж бүртгэгдэнэ. Админ
   * логоо уншихгүй бол ХЭЗЭЭ Ч мэдэхгүй: худалдан авагч баримт
   * авахгүй, нууц үг сэргээх холбоос хэзээ ч ирэхгүй.
   */
  get isConfigured(): boolean {
    return this.ses !== null;
  }
  private readonly from: string;
  private readonly siteUrl: string;
  /**
   * ⚠️ БРЭНДИЙН ЛОГО — имэйлийн толгойд жинхэнэ PNG лого (текст биш).
   * Admin-д оруулсан лого R2-д `brand/logo.png` нэрээр хадгалагддаг
   * (settings brand). Тогтмол тул хатуу URL — имэйл бүрд settings
   * дуудвал удаана. Solix биш бол ENV-ээр дарж бичиж болно.
   */
  private readonly logoUrl: string;
  /**
   * ⚠️ API-ийн ГАДААД хаяг — нээлтийн pixel-д. Шуудангийн клиент
   * (Gmail сервер) энэ хаягийг ИНТЕРНЭТЭЭС татна, тиймээс дотоод
   * docker хаяг (besttv-backend:4100) БОЛОХГҮЙ.
   */
  private readonly apiUrl: string;
  /**
   * ⚠️ SES Configuration Set — Open/Click/Bounce үйл явдлыг SNS руу
   * илгээхэд ЗААВАЛ. Тохируулаагүй бол `undefined` (имэйл хэвийн явна,
   * зүгээр л хяналт ажиллахгүй).
   */
  private readonly configSet: string | undefined;
  private readonly queue: Array<() => Promise<unknown>> = [];
  private draining = false;
  /** email → suppressed. TTL 5 мин (шинэ bounce удалгүй мөрдөгдөнө) */
  private readonly suppressionCache = new Map<string, { v: boolean; at: number }>();
  private readonly SUPPRESSION_TTL = 5 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.from = this.config.get<string>('MAIL_FROM') ?? 'noreply@besttv.us';
    this.siteUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://besttv.us';
    this.logoUrl =
      this.config.get<string>('EMAIL_LOGO_URL') ?? 'https://assets.besttv.us/brand/logo.png';
    /* ⚠️ Gmail сервер интернэтээс татна — дотоод docker хаяг БОЛОХГҮЙ */
    this.apiUrl = (
      this.config.get<string>('PUBLIC_API_URL') ?? 'https://api.besttv.us'
    ).replace(/\/$/, '');

    const region = this.config.get<string>('AWS_REGION') ?? 'eu-north-1';
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    /* Хоосон мөр → undefined (SES хоосон нэр хүлээж авдаггүй) */
    this.configSet = this.config.get<string>('SES_CONFIGURATION_SET')?.trim() || undefined;

    if (accessKeyId && secretAccessKey) {
      this.ses = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
      this.logger.log(
        `AWS SES бэлэн — ${region}, sender: ${this.from}` +
          (this.configSet ? `, хяналт: ${this.configSet}` : ', хяналтгүй'),
      );
    } else {
      this.ses = null;
      this.logger.warn('AWS түлхүүр байхгүй — имэйл илгээхгүй (лог хийнэ)');
    }
  }

  // ─── Дараалал ───────────────────────────────────────────────────────────────

  private enqueue(task: () => Promise<unknown>) {
    this.queue.push(task);
    if (!this.draining) void this.drain();
  }

  private async drain() {
    this.draining = true;
    while (this.queue.length) {
      const task = this.queue.shift()!;
      await task().catch(() => null);
      // ⚠️ SES-ийн секундын хязгаарт цохиулахгүй
      if (this.queue.length) await new Promise((r) => setTimeout(r, 300));
    }
    this.draining = false;
  }

  // ─── Suppression ────────────────────────────────────────────────────────────

  async isSuppressed(email: string): Promise<boolean> {
    const key = email.toLowerCase().trim();

    /**
     * ⚠️⚠️ ОРЛУУЛАГЧ ХАЯГ РУУ ХЭЗЭЭ Ч ИЛГЭЭХГҮЙ.
     *
     * Facebook нь хэрэглэгч имэйл хуваалцаагүй үед бид
     * `oauth_facebook_{id}@noemail.besttv.mn` гэсэн ЖИНХЭНЭ БИШ хаяг
     * үүсгэдэг (`User.email` нь required тул). Тэр домэйнд MX бичлэг
     * БАЙХГҮЙ учир илгээх бүрд hard bounce болно.
     *
     * SES-д bounce харьцаа 5%-иас хэтэрвэл илгээх эрх ТҮДГЭЛЗҮҮЛНЭ —
     * бүх хэрэглэгчийн имэйл (баталгаажуулалт, төлбөрийн баримт)
     * зогсоно. Тиймээс DB хүртэл очихгүй, ЭНД шүүнэ.
     *
     * ⚠️ Форматгүй хог хаягийг ч мөн адил (OAuth-аас хачин утга ирж
     * DB-д үлдсэн байж болно).
     */
    if (key.endsWith('@noemail.besttv.mn') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
      return true;
    }

    const c = this.suppressionCache.get(key);
    if (c && Date.now() - c.at < this.SUPPRESSION_TTL) return c.v;
    try {
      const row = await this.prisma.emailSuppression.findUnique({ where: { email: key } });
      const v = !!row;
      this.suppressionCache.set(key, { v, at: Date.now() });
      return v;
    } catch {
      // DB алдаанд имэйлийг блоклохгүй (false-safe), кэшлэхгүй
      return false;
    }
  }

  async addSuppression(email: string, reason: string, subType?: string, detail?: string) {
    const key = email.toLowerCase().trim();
    await this.prisma.emailSuppression
      .upsert({
        where: { email: key },
        create: { email: key, reason, subType, detail },
        update: { reason, subType, detail },
      })
      .catch(() => null);
    this.suppressionCache.set(key, { v: true, at: Date.now() });
  }

  // ─── Илгээх ─────────────────────────────────────────────────────────────────

  private isGuest = (e: string) => e.endsWith('@guest.besttv.mn') || e.endsWith('@besttv.test');
  private isValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !this.isGuest(e);

  /**
   * Шууд илгээх (дараалалгүй) — үр дүнг хүлээх шаардлагатай үед.
   * Ихэнх тохиолдолд `queueSend` ашиглана.
   */
  async send(opts: {
    to: string;
    subject: string;
    html: string;
    template: EmailTemplate;
    userId?: string;
    replyTo?: string;
    /**
     * ⚠️ Нээлтийн pixel хийх эсэх. Гүйлгээний имэйлд (нууц үг, OTP)
     * ХЯНАХГҮЙ — хувийн нууцлалын хувьд шаардлагагүй, мөн зарим
     * шуудангийн шүүлтүүр pixel-тэй имэйлийг сэжиглэдэг.
     */
    track?: boolean;
    /** ⚠️ Bulk бүлэг — нэг илгээлтийн бүх имэйл ижил batchId (фолдер) */
    batchId?: string;
    batchLabel?: string;
  }): Promise<boolean> {
    const to = opts.to.toLowerCase().trim();

    if (!this.isValid(to)) {
      this.logger.debug(`Алгаслаа (буруу/зочин хаяг): ${to}`);
      return false;
    }
    if (await this.isSuppressed(to)) {
      this.logger.warn(`Алгаслаа (suppression): ${to}`);
      await this.log(to, opts.subject, opts.template, 'suppressed', null, opts.userId);
      return false;
    }
    if (!this.ses) {
      this.logger.warn(`SES тохируулаагүй — илгээгээгүй: ${opts.subject} → ${to}`);
      await this.log(to, opts.subject, opts.template, 'failed', 'SES тохируулаагүй', opts.userId);
      return false;
    }

    /**
     * ⚠️⚠️ ЛОГИЙГ ИЛГЭЭХЭЭС ӨМНӨ ҮҮСГЭНЭ — нээлтийн pixel-д ID хэрэгтэй.
     *
     * Урсгал: лог үүсгэ → ID-г pixel-д суулга → илгээ → үр дүнг ШИНЭЧИЛ.
     * (Өмнө нь илгээсний ДАРАА лог үүсгэдэг байсан тул pixel-д тавих
     *  ID байхгүй, нээлт хянах боломжгүй байв.)
     */
    let logId: string | null = null;
    let html = opts.html;
    if (opts.track) {
      logId = await this.prisma.emailLog
        .create({
          data: {
            to,
            subject: opts.subject,
            template: opts.template,
            status: 'sending',
            userId: opts.userId,
            batchId: opts.batchId,
            batchLabel: opts.batchLabel,
          },
          select: { id: true },
        })
        .then((r) => r.id)
        .catch(() => null);

      /* ⚠️ Pixel-ийг </body> өмнө нэмнэ — layout аль хэдийн байрлуулсан
         бол давхардахгүй (layout нь logId авбал өөрөө нэмнэ) */
      if (logId && !html.includes('/api/email/open')) {
        const px = `<img src="${this.apiUrl}/api/email/open?l=${encodeURIComponent(logId)}&e=${encodeURIComponent(to)}&t=${encodeURIComponent(opts.template)}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0" />`;
        html = html.includes('</body>') ? html.replace('</body>', `${px}</body>`) : html + px;
      }

      /* ⚠️ Pixel НЭМЭГДСЭН хувилбарыг хадгална — хэрэглэгчийн
         хүлээн авсантай ЯГ ИЖИЛ байх ёстой */
      if (logId) {
        await this.prisma.emailLog
          .update({ where: { id: logId }, data: { html } })
          .catch(() => null);
      }
    }

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        /**
         * ⚠️⚠️ ХАРИУГ ЗААВАЛ АВНА — `MessageId` нь SNS-ийн үйл явдлыг
         * (Delivery/Open/Click/Bounce) энэ мөртэй холбох ЦОРЫН ГАНЦ түлхүүр.
         *
         * Өмнө нь `await this.ses.send(...)` гэж хариуг ОГТ авдаггүй
         * байсан тул MessageId алдагдаж, хүргэлт/нээлт хянах боломжгүй байв.
         */
        const res = await this.ses.send(
          new SendEmailCommand({
            Source: `BestTV <${this.from}>`,
            Destination: { ToAddresses: [to] },
            ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
            Message: {
              Subject: { Data: opts.subject, Charset: 'UTF-8' },
              /* ⚠️ `html` (opts.html БИШ) — нээлтийн pixel нэмэгдсэн хувилбар */
              Body: { Html: { Data: html, Charset: 'UTF-8' } },
            },
            /**
             * ⚠️⚠️ АЮУЛТАЙ ТАЛБАР — БУРУУ НЭР ӨГВӨЛ ИМЭЙЛ ОГТ ЯВАХГҮЙ.
             *
             * БОДИТ ХЭМЖИЛТ: байхгүй Set-ийн нэр өгөхөд SES нь
             * `ConfigurationSetDoesNotExistException` шидэж, имэйл
             * БҮРЭН УНАНА (тавтай морил, нууц үг сэргээх — бүгд).
             *
             * Тиймээс:
             *   • env тохируулаагүй бол `undefined` — SES талбарыг
             *     огт үзэхгүй, имэйл хэвийн явна.
             *   • Тохируулсан ч AWS-д тэр нэртэй Set БАЙХГҮЙ бол
             *     БҮГД унана. Env-д бичихээсээ ӨМНӨ AWS дээр үүсгэсэн
             *     эсэхээ ЗААВАЛ шалга.
             *
             * ⚠️ НЭЭЛТ хянахад энэ ШААРДЛАГАГҮЙ — өөрийн 1×1 pixel
             *    (`/api/email/open`, `EmailPublicController`) ашигладаг.
             *    Энэ талбар нь зөвхөн AWS-ийн ХҮРГЭЛТ/BOUNCE/COMPLAINT
             *    үйл явдал авах үед л хэрэгтэй (SNS webhook).
             */
            ConfigurationSetName: this.configSet,
          }),
        );
        /**
         * ⚠️ Мөр аль хэдийн үүссэн бол ШИНЭЧИЛНЭ (давхар мөр үүсгэхгүй).
         * Үүсээгүй (track=false) бол шинээр бичнэ.
         */
        if (logId) {
          await this.prisma.emailLog
            .update({
              where: { id: logId },
              data: { status: 'sent', messageId: res?.MessageId ?? null },
            })
            .catch(() => null);
        } else {
          await this.log(
            to,
            opts.subject,
            opts.template,
            'sent',
            null,
            opts.userId,
            res?.MessageId ?? null,
            /* ⚠️ track унтарсан үед ч HTML хадгална — админ харна */
            html,
          );
        }
        return true;
      } catch (err) {
        lastErr = err;
        // ⚠️ Permanent алдаанд retry ХИЙХГҮЙ — SES reputation хамгаална
        if (!this.isTransient(err) || attempt === MAX_ATTEMPTS) break;
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    this.logger.error(`Имэйл амжилтгүй → ${to}: ${msg}`);
    if (logId) {
      await this.prisma.emailLog
        .update({ where: { id: logId }, data: { status: 'failed', error: msg } })
        .catch(() => null);
    } else {
      await this.log(to, opts.subject, opts.template, 'failed', msg, opts.userId);
    }
    return false;
  }

  /**
   * Алдаа ТҮР зуурынх эсэх.
   *
   * ⚠️ ЗӨВХӨН нэрээр шалгах нь ХАНГАЛТГҮЙ: AWS-ийн зарим 5xx алдаа
   * танихгүй нэртэй ирдэг тул permanent гэж андуурч, имэйл ЧИМЭЭГҮЙ
   * алдагдана. HTTP статусыг ч шалгана (DigitalGer-ийн батлагдсан арга).
   */
  private isTransient(err: unknown): boolean {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name && TRANSIENT.has(e.name)) return true;
    const code = e?.$metadata?.httpStatusCode;
    return typeof code === 'number' && code >= 500;
  }

  /** Дараалалд оруулна — хариу хүлээхгүй (HTTP хариу удаашруулахгүй) */
  queueSend(opts: Parameters<EmailService['send']>[0]) {
    this.enqueue(() => this.send(opts));
  }

  private async log(
    to: string,
    subject: string,
    template: string,
    status: string,
    error: string | null,
    userId?: string,
    /** SES-ийн MessageId — SNS үйл явдлыг холбох түлхүүр */
    messageId?: string | null,
    /** ⚠️ Яг илгээсэн HTML — админ бодит имэйлийг харна */
    html?: string | null,
  ) {
    await this.prisma.emailLog
      .create({ data: { to, subject, template, status, error, userId, messageId, html } })
      .catch(() => null);
  }

  // ─── Загвар (layout) ────────────────────────────────────────────────────────

  private money = (n: number) => `${n.toLocaleString('mn-MN')}₮`;

  private date(d: Date | string): string {
    const x = typeof d === 'string' ? new Date(d) : d;
    return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`;
  }

  /**
   * Бүх имэйлийн НЭГДСЭН layout.
   * ⚠️ Table-based — Outlook/Gmail зэрэг бүх client зөв харуулна (flex/grid БОЛОХГҮЙ).
   */
  private layout(opts: {
    heading: string;
    bodyHtml: string;
    ctaText?: string;
    ctaUrl?: string;
    preheader?: string;
    showUnsubscribe?: boolean;
    email?: string;
    /** ⚠️ Нээлтийн pixel-д — байхгүй бол pixel огт нэмэхгүй */
    logId?: string;
    template?: string;
  }): string {
    const cta =
      opts.ctaText && opts.ctaUrl
        ? `<tr><td style="padding:4px 32px 28px;text-align:center">
             <a href="${opts.ctaUrl}" class="btv-cta" style="display:inline-block;background:#e50914;color:#fff;font-weight:700;font-size:15px;padding:14px 34px;border-radius:10px;text-decoration:none">${opts.ctaText}</a>
           </td></tr>`
        : '';
    const pre = opts.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
      : '';
    /**
     * ⚠️⚠️ ГАРЫН ҮСЭГТЭЙ ХОЛБООС.
     *
     * Өмнө нь зөвхөн `?email=…` байсан тул ХЭН Ч дурын хаягийг бичээд
     * тэр хүнийг маркетингаас салгаж чаддаг байв. Одоо HMAC гарын
     * үсэг нэмнэ — зөвхөн сервер тооцоолж чадна.
     */
    const unsub =
      opts.showUnsubscribe && opts.email
        ? `<p style="margin:8px 0 0;font-size:11px;color:#666">Эдгээр имэйлийг авахыг хүсэхгүй бол <a href="${this.siteUrl}/unsubscribe?email=${encodeURIComponent(opts.email)}&sig=${signUnsubscribe(opts.email)}" style="color:#888;text-decoration:underline">Unsubscribe</a>.</p>`
        : '';

    /**
     * ⚠️⚠️ НЭЭЛТ ХЯНАХ PIXEL — 1×1 тунгалаг GIF.
     *
     * Шуудангийн клиент зургийг татахад `/api/email/open` дуудагдаж
     * нээлт бүртгэгдэнэ. AWS Configuration Set ШААРДЛАГАГҮЙ —
     * DigitalGer дээр ажиллаж байгаа зарчим.
     *
     * ⚠️ `logId` заавал — түүгээр л EmailLog-ийн мөртэй холбогдоно.
     *    Байхгүй бол pixel огт нэмэхгүй (утгагүй дуудалт хийхгүй).
     *
     * ⚠️ ХЯЗГААР: Gmail зэрэг зургийг proxy-ээр дамжуулдаг, зарим
     *    клиент огт татдаггүй. Тиймээс бодит нээлт нь харагдахаас
     *    ӨНДӨР байна — салбарын нийтлэг хязгаарлалт.
     */
    const pixel =
      opts.logId && opts.email
        ? `<img src="${this.apiUrl}/api/email/open?l=${encodeURIComponent(opts.logId)}&e=${encodeURIComponent(opts.email)}&t=${encodeURIComponent(opts.template ?? '')}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0" />`
        : '';

    /**
     * WARN DARK-MODE DECLARATION - without it the email is unreadable.
     *
     * Real complaint: text vanished for some recipients. This template
     * is dark by design (#0d0e11 ground, white text), but Gmail and
     * Outlook assume an email is LIGHT unless told otherwise. In the
     * reader's dark mode they then "helpfully" invert the colors -
     * white text becomes dark, the dark ground becomes light, and the
     * result is white-on-white.
     *
     * Three things are needed, and all three must agree:
     *   1. `<meta name="color-scheme">` - tells the client this email
     *      already handles both schemes, so stop transforming it
     *   2. `supported-color-schemes` - the same signal for Apple Mail
     *   3. `:root { color-scheme }` in CSS - Gmail strips <meta> in
     *      some views but keeps the style block
     *
     * WARN We deliberately declare `dark light` (dark FIRST): the
     * design IS dark, and this order stops clients from forcing a
     * light repaint. Do not "simplify" this to `only light`.
     */
    return `<!DOCTYPE html><html lang="mn"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<style>
  :root { color-scheme: dark light; supported-color-schemes: dark light; }
  /* WARN Gmail/Outlook dark mode: keep OUR colors, block the inversion */
  @media (prefers-color-scheme: dark) {
    /* ⚠️ Гадна дэвсгэр (btv-bg) нь ХАР БИШ — зөвхөн КАРТ бараан.
       HBO/Netflix шиг: карт голлож, гадна нь зөөлөн саарал. Өмнө нь
       #0d0e11 (бүтэн хар) байсан тул имэйл «pad хар» харагддаг байв. */
    .btv-bg   { background:#20222a !important; }
    .btv-card { background:#17181c !important; }
    /* ⚠️ Толгой ЦАГААН хэвээр (dark OS-д ч) — лого «Best» хэсэг хар/улаан
       тул хар дэвсгэрт үл үзэгдэнэ. Цагаан толгой = лого үргэлж бүтэн. */
    .btv-head { background:#ffffff !important; }
    .btv-foot { background:#101114 !important; }
    .btv-text, .btv-text * { color:#ffffff !important; }
    .btv-muted, .btv-muted * { color:#c8c8ce !important; }
    .btv-box  { background:#1e1f24 !important; }
    /* WARN Brand red must survive inversion - it is the only CTA */
    .btv-cta  { background:#e50914 !important; color:#ffffff !important; }
  }
  /* Outlook.com rewrites classes with a [data-ogsc] prefix */
  [data-ogsc] .btv-bg   { background:#20222a !important; }
  [data-ogsc] .btv-card { background:#17181c !important; }
  [data-ogsc] .btv-text, [data-ogsc] .btv-text * { color:#ffffff !important; }
  [data-ogsc] .btv-muted, [data-ogsc] .btv-muted * { color:#c8c8ce !important; }
</style>
</head>
<body class="btv-bg" style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,system-ui,sans-serif">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" class="btv-bg" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" class="btv-card" style="background:#17181c;border-radius:16px;overflow:hidden;max-width:600px;width:100%">
  <tr><td class="btv-head" style="background:#ffffff;padding:20px 32px;text-align:center;border-bottom:1px solid #ececec">
    <a href="${this.siteUrl}" style="display:inline-block;text-decoration:none">
      <img src="${this.logoUrl}" alt="BestTV" height="34" style="display:block;height:34px;width:auto;border:0" />
    </a>
  </td></tr>
  <tr><td style="padding:32px 32px 8px">
    <h1 class="btv-text" style="margin:0 0 14px;font-size:21px;font-weight:800;color:#fff;line-height:1.35">${opts.heading}</h1>
    ${opts.bodyHtml}
  </td></tr>
  ${cta}
  <tr><td class="btv-foot" style="background:#101114;padding:20px 32px;text-align:center;border-top:1px solid #26272b">
    <p class="btv-muted" style="margin:0;font-size:12px;color:#777">© ${new Date().getFullYear()} BestTV · <a href="${this.siteUrl}" style="color:#999;text-decoration:none">besttv.us</a></p>
    ${unsub}
${pixel}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  }

  /** Дотоод мэдээллийн хайрцаг (захиалгын дэлгэрэнгүй гэх мэт) */
  private box(rows: [string, string][]): string {
    return `<table width="100%" cellpadding="0" cellspacing="0" class="btv-box" style="background:#1e1f24;border-radius:10px;margin:16px 0">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td class="btv-muted" style="padding:10px 16px;font-size:13px;color:#9a9aa0">${k}</td>
             <td class="btv-text" style="padding:10px 16px;font-size:14px;color:#fff;font-weight:600;text-align:right">${v}</td></tr>`,
        )
        .join('')}
    </table>`;
  }

  private p = (t: string) =>
    `<p class="btv-muted" style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#c8c8ce">${t}</p>`;

  // ─── Public template-ууд ────────────────────────────────────────────────────

  /** Бүртгэл амжилттай — тавтай морил */
  sendWelcome(opts: { to: string; name?: string | null; userId?: string }) {
    const html = this.layout({
      heading: `Тавтай морил${opts.name ? `, ${opts.name}` : ''}! 🎬`,
      preheader: 'BestTV-д тавтай морил — мянга мянган кино таныг хүлээж байна',
      bodyHtml:
        this.p('Таны BestTV бүртгэл амжилттай үүслээ.') +
        this.p(
          'Одооноос та хүссэн кинонуудаа шууд үзэх боломжтой. Төлбөртэй контентыг үзэхийн тулд багц авах эсвэл киног ширхэгээр түрээслэнэ үү.',
        ),
      ctaText: 'Кино үзэж эхлэх',
      ctaUrl: this.siteUrl,
    });
    this.queueSend({
      to: opts.to,
      subject: 'BestTV-д тавтай морил! 🎬',
      html,
      template: 'welcome',
      userId: opts.userId,
    });
  }

  /** Имэйл баталгаажуулах OTP код */
  async sendOtp(opts: {
    to: string;
    code: string;
    name?: string | null;
    purpose: 'verify' | 'change';
    userId?: string;
  }) {
    const isChange = opts.purpose === 'change';
    const html = this.layout({
      heading: isChange ? 'Имэйл солих баталгаажуулалт' : 'Имэйл хаягаа баталгаажуулна уу',
      preheader: `Баталгаажуулах код: ${opts.code}`,
      bodyHtml:
        this.p(
          isChange
            ? 'Та имэйл хаягаа энэ хаяг руу солих хүсэлт илгээлээ. Доорх кодыг оруулж баталгаажуулна уу.'
            : 'Доорх кодыг оруулж имэйл хаягаа баталгаажуулна уу.',
        ) +
        `<div style="margin:20px 0;padding:18px;background:#1e1f24;border-radius:12px;text-align:center">
           <span style="font-size:32px;font-weight:900;letter-spacing:10px;color:#fff">${opts.code}</span>
         </div>` +
        this.p(
          '<strong style="color:#fff">10 минутын дотор</strong> ашиглана уу. Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.',
        ),
    });
    // ⚠️ OTP нь ХҮЛЭЭЛТТЭЙ — хэрэглэгч код хүлээж байгаа тул шууд илгээнэ
    return this.send({
      to: opts.to,
      subject: `BestTV баталгаажуулах код: ${opts.code}`,
      html,
      template: 'verify',
      userId: opts.userId,
    });
  }

  /**
   * Нууц үг сэргээх линк.
   *
   * ⚠️ ХҮЛЭЭЛТТЭЙ илгээлт (`send`, `queueSend` БИШ) — хэрэглэгч имэйлээ
   * шинэчилж хүлээж сууна. Мөн илгээлт амжилтгүй болбол сервис талд
   * мэдэгдэх хэрэгтэй (гэхдээ хэрэглэгчид ЯЛГААТАЙ хариу өгөхгүй —
   * `auth.service.ts` дахь тайлбарыг үз).
   */
  /**
   * WARN Sent when someone requests unsubscribe WITHOUT a valid signature.
   *
   * Emails sent before signatures existed carry no `sig`, so a real user
   * clicking an old link must still be able to opt out. Rather than
   * trusting the request (which is exactly the hole we closed), we mail
   * the address a freshly signed link. Only the real owner can act on it.
   */
  async sendUnsubscribeConfirm(to: string) {
    const url = `${this.siteUrl}/unsubscribe?email=${encodeURIComponent(to)}&sig=${signUnsubscribe(to)}`;
    const html = this.layout({
      heading: 'Имэйл цуцлахыг баталгаажуулна уу',
      preheader: 'Доорх товчийг дарж маркетингийн имэйлээс салгана',
      bodyHtml:
        this.p('Та BestTV-ийн маркетингийн имэйлээс салах хүсэлт илгээлээ.') +
        this.p('Баталгаажуулахын тулд доорх товчийг дарна уу. Үүнийг хийтэл таны тохиргоо ӨӨРЧЛӨГДӨӨГҮЙ.') +
        /* Same reassurance pattern as password reset: if a stranger
           triggered this, the real owner must know inaction is safe. */
        this.p('Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу — юу ч өөрчлөгдөхгүй.') +
        `<p class="btv-muted" style="margin:16px 0 0;font-size:11px;line-height:1.6;word-break:break-all">
           Товч ажиллахгүй бол энэ хаягийг browser-т хуулна уу:<br>${url}
         </p>`,
      ctaText: 'Тийм, цуцлах',
      ctaUrl: url,
    });
    return this.send({
      to,
      subject: 'BestTV — имэйл цуцлахыг баталгаажуулна уу',
      html,
      template: 'unsubscribe-confirm',
    });
  }

  /**
   * WARN QPay QR created but never paid.
   *
   * Measured on production: 10 of 34 payment attempts expired unpaid
   * (29%). We do not know why - wrong bank app, second thoughts, or a
   * technical snag - so this is a plain, non-pushy reminder with a
   * direct link back, not a discount offer.
   *
   * WARN Transactional in tone but it IS a nudge, so `showUnsubscribe`
   * stays on and the caller must skip users who opted out.
   *
   * WARN Wording is the admin's own - warm and forward-looking rather
   * than an "ignore this if you changed your mind" disclaimer. Do not
   * rewrite it back to the reassurance pattern used by password reset.
   */
  async sendPaymentAbandoned(opts: {
    to: string;
    name?: string | null;
    planName: string;
    amount: number;
    userId?: string;
  }) {
    const url = `${this.siteUrl}/pricing`;
    const html = this.layout({
      heading: 'Төлбөр дуусаагүй байна',
      preheader: `${opts.planName} — ${this.money(opts.amount)}`,
      email: opts.to,
      showUnsubscribe: true,
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.p(
          /* ⚠️ «багц» гэдэг үгийг НЭМЭХГҮЙ — багцын нэрэнд аль хэдийн
             орсон байдаг («Монгол кино багц»), эс бөгөөс «багц багцыг»
             гэж давхардана. */
          `Та <strong style="color:#fff">${opts.planName}</strong>-ыг ` +
            `<strong style="color:#fff">${this.money(opts.amount)}</strong>-өөр ` +
            'авахаар дарсан ч төлбөр төлөгдөөгүй байна.',
        ) +
        this.p(
          'Доорх товчийг дарж хэдхэн секундэд үргэлжлүүлж төлбөрөө ' +
            'баталгаажуулах боломжтой.',
        ) +
        this.p(
          'Бидэнтэй хамт байгаад баярлалаа. Маш олон сонирхолтой кино ' +
            'нэмэгдсэн байгаа шүү 🎬',
        ),
      ctaText: 'Үргэлжлүүлэх',
      ctaUrl: url,
    });
    return this.send({
      to: opts.to,
      subject: 'BestTV — төлбөр дуусаагүй байна',
      html,
      template: 'payment-abandoned',
      userId: opts.userId,
    });
  }

  async sendPasswordReset(opts: {
    to: string;
    resetUrl: string;
    name?: string | null;
    expiresMinutes: number;
    userId?: string;
  }) {
    const html = this.layout({
      heading: 'Нууц үг сэргээх',
      preheader: 'Нууц үгээ сэргээх линк — 1 цаг хүчинтэй',
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.p(
          'Та BestTV бүртгэлийнхээ нууц үгийг сэргээх хүсэлт илгээлээ. Доорх товчийг дарж шинэ нууц үгээ тохируулна уу.',
        ) +
        this.p(
          `Энэ линк <strong style="color:#fff">${opts.expiresMinutes} минутын дотор</strong> хүчинтэй бөгөөд <strong style="color:#fff">ганц удаа</strong> ашиглагдана.`,
        ) +
        /* ⚠️ "Би хүсээгүй" гэсэн заавар ЗААВАЛ — хэрэв хэн нэгэн өөр
           хүний имэйлээр хүсэлт илгээвэл жинхэнэ эзэн нь сандрахгүй,
           бас юу ч хийхгүй байхад аюулгүй гэдгээ мэднэ. */
        this.p(
          'Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу — таны нууц үг хэвээр хадгалагдана.',
        ) +
        /* Зарим имэйл клиент товчийг блоклодог тул түүхий URL-ыг ч өгнө */
        `<p class="btv-muted" style="margin:16px 0 0;font-size:11px;line-height:1.6;word-break:break-all">
           Товч ажиллахгүй бол энэ хаягийг browser-т хуулна уу:<br>${opts.resetUrl}
         </p>`,
      ctaText: 'Нууц үг сэргээх',
      ctaUrl: opts.resetUrl,
    });
    return this.send({
      to: opts.to,
      subject: 'BestTV — нууц үг сэргээх',
      html,
      template: 'password-reset',
      userId: opts.userId,
    });
  }

  /**
   * Нууц үг амжилттай солигдлоо (мэдэгдэл).
   * ⚠️ Энэ имэйл нь ЗӨВХӨН мэдээлэх зорилготой биш — халдлагч бүртгэл
   * булаасан тохиолдолд жинхэнэ эзэн нь ШУУД мэдэж, арга хэмжээ авна.
   */
  sendPasswordChanged(opts: { to: string; name?: string | null; userId?: string }) {
    const html = this.layout({
      heading: 'Нууц үг солигдлоо ✅',
      preheader: 'Таны BestTV бүртгэлийн нууц үг амжилттай солигдлоо',
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.p('Таны BestTV бүртгэлийн нууц үг саяхан солигдлоо.') +
        this.p(
          '<strong style="color:#fff">Хэрэв та үүнийг хийгээгүй бол</strong> яаралтай бидэнтэй холбогдож, бүртгэлээ хамгаална уу.',
        ),
      ctaText: 'Нэвтрэх',
      ctaUrl: `${this.siteUrl}/login`,
    });
    this.queueSend({
      to: opts.to,
      subject: 'BestTV — нууц үг солигдлоо',
      html,
      template: 'password-changed',
      userId: opts.userId,
    });
  }

  /** Багц худалдан авалт баталгаажлаа */
  sendSubscriptionActivated(opts: {
    to: string;
    name?: string | null;
    planName: string;
    amount: number;
    expiresAt: Date | string;
    genres?: string[];
    isVip?: boolean;
    userId?: string;
  }) {
    const rows: [string, string][] = [
      ['Багц', opts.planName],
      ['Төлсөн дүн', opts.amount > 0 ? this.money(opts.amount) : 'Үнэгүй'],
      ['Дуусах огноо', this.date(opts.expiresAt)],
    ];
    if (opts.isVip) rows.push(['Нээгдэх контент', 'Бүх контент (VIP)']);
    else if (opts.genres?.length) rows.push(['Нээгдэх ангилал', opts.genres.join(', ')]);

    const html = this.layout({
      heading: 'Багц амжилттай идэвхжлээ 🎉',
      preheader: `${opts.planName} — ${this.date(opts.expiresAt)} хүртэл`,
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}! Таны багц идэвхжлээ.`) +
        this.box(rows) +
        this.p('Одоо та эрхийн хүрээнд байгаа бүх контентыг хязгааргүй үзэх боломжтой.'),
      ctaText: 'Кино үзэх',
      ctaUrl: this.siteUrl,
    });
    this.queueSend({
      to: opts.to,
      subject: `${opts.planName} идэвхжлээ — BestTV`,
      html,
      template: 'subscription',
      userId: opts.userId,
    });
  }

  /** Ширхэгээр түрээслэсэн */
  sendRentalConfirmation(opts: {
    to: string;
    name?: string | null;
    titleName: string;
    titleSlug: string;
    amount: number;
    expiresAt: Date | string;
    hours: number;
    userId?: string;
  }) {
    const html = this.layout({
      heading: 'Түрээс амжилттай ✅',
      preheader: `${opts.titleName} — ${opts.hours} цагийн турш үзнэ`,
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.box([
          ['Кино', opts.titleName],
          ['Төлсөн дүн', this.money(opts.amount)],
          ['Хугацаа', `${opts.hours} цаг`],
          ['Дуусах', this.date(opts.expiresAt)],
        ]) +
        this.p('Хугацаанд багтаан хязгааргүй үзэх боломжтой.'),
      ctaText: 'Одоо үзэх',
      ctaUrl: `${this.siteUrl}/movie/${opts.titleSlug}`,
    });
    this.queueSend({
      to: opts.to,
      subject: `${opts.titleName} — түрээс баталгаажлаа`,
      html,
      template: 'rental',
      userId: opts.userId,
    });
  }

  /**
   * Түрээс дуусах гэж байна (сануулга).
   *
   * ⚠️ ЦАГААР тооцно — түрээс ихэвчлэн 48 цаг тул "3 хоногийн дараа"
   * гэсэн багцын хэв маяг тохирохгүй.
   * ⚠️ Сунгах биш ДУУСГАХ мессеж: түрээсийг сунгах боломж байхгүй тул
   * "хугацаанд багтаж үзээрэй" гэж уриална (дахин түрээслүүлэх нь
   * шударга бус мэдрэгдэнэ).
   */
  sendRentalExpiring(opts: {
    to: string;
    name?: string | null;
    titleName: string;
    titleSlug: string;
    expiresAt: Date | string;
    hoursLeft: number;
    userId?: string;
  }) {
    const html = this.layout({
      heading: `Түрээс ${opts.hoursLeft} цагийн дараа дуусна`,
      preheader: `${opts.titleName} — үзэж амжаарай`,
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.box([
          ['Кино', opts.titleName],
          ['Дуусах', this.date(opts.expiresAt)],
        ]) +
        this.p('Хугацаа дуусахаас өмнө үзэж амжаарай.'),
      ctaText: 'Одоо үзэх',
      ctaUrl: `${this.siteUrl}/movie/${opts.titleSlug}`,
    });
    this.queueSend({
      to: opts.to,
      subject: `${opts.titleName} — түрээс удахгүй дуусна`,
      html,
      template: 'rental-expiring',
      userId: opts.userId,
    });
  }

  /** Хэтэвч цэнэглэгдлээ */
  sendWalletTopup(opts: {
    to: string;
    name?: string | null;
    amount: number;
    balance: number;
    userId?: string;
  }) {
    const html = this.layout({
      heading: 'Хэтэвч цэнэглэгдлээ 💳',
      preheader: `${this.money(opts.amount)} нэмэгдлээ`,
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.box([
          ['Цэнэглэсэн дүн', this.money(opts.amount)],
          ['Одоогийн үлдэгдэл', this.money(opts.balance)],
        ]) +
        this.p('Хэтэвчээрээ багц авах эсвэл кино түрээслэх боломжтой.'),
      ctaText: 'Багц үзэх',
      ctaUrl: `${this.siteUrl}/pricing`,
    });
    this.queueSend({
      to: opts.to,
      subject: `Хэтэвч ${this.money(opts.amount)}-өөр цэнэглэгдлээ`,
      html,
      template: 'payment',
      userId: opts.userId,
    });
  }

  /** Багц дуусах гэж байна (сануулга) */
  sendExpiringSoon(opts: {
    to: string;
    name?: string | null;
    planName: string;
    expiresAt: Date | string;
    daysLeft: number;
    userId?: string;
  }) {
    const html = this.layout({
      heading: `Таны багц ${opts.daysLeft} хоногийн дараа дуусна`,
      preheader: `${opts.planName} — ${this.date(opts.expiresAt)}`,
      bodyHtml:
        this.p(`Сайн байна уу${opts.name ? `, ${opts.name}` : ''}!`) +
        this.box([
          ['Багц', opts.planName],
          ['Дуусах огноо', this.date(opts.expiresAt)],
        ]) +
        this.p('Тасралтгүй үзэхийн тулд багцаа сунгана уу.'),
      ctaText: 'Багц сунгах',
      ctaUrl: `${this.siteUrl}/pricing`,
    });
    this.queueSend({
      to: opts.to,
      subject: `Багц ${opts.daysLeft} хоногийн дараа дуусна — BestTV`,
      html,
      template: 'expiring',
      userId: opts.userId,
    });
  }

  /** Админаас илгээх маркетинг имэйл (олон хүлээн авагч) */
  sendMarketing(opts: {
    to: string;
    subject: string;
    heading: string;
    bodyHtml: string;
    ctaText?: string;
    ctaUrl?: string;
    /**
     * ⚠️⚠️ ЗААВАЛ дамжуулна (амьдралын мөчлөгийн имэйлд).
     *
     * БОДИТ АСУУДАЛ: өмнө нь энэ параметр БАЙХГҮЙ байсан тул бүх
     * маркетингийн `EmailLog` мөр `userId = null` болдог. Тэгвэл
     * «энэ хүнд өнгөрсөн 30 хоногт win-back илгээсэн үү?» гэдгийг
     * ШАЛГАХ БОЛОМЖГҮЙ — хэрэглэгч ижил имэйлийг дахин дахин авна.
     */
    userId?: string;
    /**
     * ⚠️ Аль урсгалынх вэ. Анхдагч `marketing` — админы бөөн
     * илгээлт. Автомат урсгалууд өөрийн төрлөө дамжуулна, эс бөгөөс
     * давхардал шалгах ба үр дүн хэмжих боломжгүй.
     */
    template?: EmailTemplate;
    /** ⚠️ Bulk бүлэг — кино реклам/broadcast-ийн бүх имэйл ижил batchId */
    batchId?: string;
    batchLabel?: string;
  }) {
    const html = this.layout({
      heading: opts.heading,
      bodyHtml: opts.bodyHtml,
      ctaText: opts.ctaText,
      ctaUrl: opts.ctaUrl,
      showUnsubscribe: true,
      email: opts.to,
    });
    /**
     * ⚠️ `track: true` — ЗӨВХӨН маркетингийн имэйлд нээлт хянана.
     *
     * Гүйлгээний имэйлд (нууц үг, OTP, төлбөр) ХЯНАХГҮЙ:
     *   • хувийн нууцлалын хувьд шаардлагагүй
     *   • зарим шуудангийн шүүлтүүр pixel-тэй имэйлийг сэжиглэдэг —
     *     нууц үг сэргээх имэйл спам руу орох нь ЯМАР Ч статистикаас
     *     илүү хортой
     */
    this.queueSend({
      to: opts.to,
      subject: opts.subject,
      html,
      template: opts.template ?? 'marketing',
      userId: opts.userId,
      track: true,
      batchId: opts.batchId,
      batchLabel: opts.batchLabel,
    });
  }

  /**
   * Амьдралын мөчлөгийн имэйлийн БИЕИЙГ бүрдүүлнэ (HTML).
   *
   * ⚠️ `layout` нь `private` тул `LifecycleService` түүнийг дуудаж
   * чадахгүй. Энэ нь тэр хаалганы цорын ганц НАРИЙН нүх — бүтэн
   * layout-ыг ил гаргахгүйгээр хэрэгцээт зүйлийг өгнө.
   */
  buildLifecycleHtml(opts: {
    to: string;
    heading: string;
    bodyHtml: string;
    ctaText?: string;
    ctaUrl?: string;
    preheader?: string;
  }): string {
    return this.layout({ ...opts, showUnsubscribe: true, email: opts.to });
  }

  /** Мөнгө/огноог имэйлийн ижил хэлбэрээр (гадна ашиглах) */
  fmtMoney(n: number): string {
    return this.money(n);
  }

  fmtDate(d: Date | string): string {
    return this.date(d);
  }
}
