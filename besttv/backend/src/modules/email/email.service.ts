import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { PrismaService } from '../../prisma/prisma.service';

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
  | 'marketing';

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
  private readonly from: string;
  private readonly siteUrl: string;
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

    const region = this.config.get<string>('AWS_REGION') ?? 'eu-north-1';
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (accessKeyId && secretAccessKey) {
      this.ses = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
      this.logger.log(`AWS SES бэлэн — ${region}, sender: ${this.from}`);
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

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.ses.send(
          new SendEmailCommand({
            Source: `BestTV <${this.from}>`,
            Destination: { ToAddresses: [to] },
            ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
            Message: {
              Subject: { Data: opts.subject, Charset: 'UTF-8' },
              Body: { Html: { Data: opts.html, Charset: 'UTF-8' } },
            },
          }),
        );
        await this.log(to, opts.subject, opts.template, 'sent', null, opts.userId);
        return true;
      } catch (err) {
        lastErr = err;
        const name = (err as { name?: string })?.name ?? '';
        // ⚠️ Permanent алдаанд retry ХИЙХГҮЙ — SES reputation хамгаална
        if (!TRANSIENT.has(name) || attempt === MAX_ATTEMPTS) break;
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    this.logger.error(`Имэйл амжилтгүй → ${to}: ${msg}`);
    await this.log(to, opts.subject, opts.template, 'failed', msg, opts.userId);
    return false;
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
  ) {
    await this.prisma.emailLog
      .create({ data: { to, subject, template, status, error, userId } })
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
  }): string {
    const cta =
      opts.ctaText && opts.ctaUrl
        ? `<tr><td style="padding:4px 32px 28px;text-align:center">
             <a href="${opts.ctaUrl}" style="display:inline-block;background:#e50914;color:#fff;font-weight:700;font-size:15px;padding:14px 34px;border-radius:10px;text-decoration:none">${opts.ctaText}</a>
           </td></tr>`
        : '';
    const pre = opts.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
      : '';
    const unsub =
      opts.showUnsubscribe && opts.email
        ? `<p style="margin:8px 0 0;font-size:11px;color:#666">Эдгээр имэйлийг авахыг хүсэхгүй бол <a href="${this.siteUrl}/unsubscribe?email=${encodeURIComponent(opts.email)}" style="color:#888;text-decoration:underline">энд дарж цуцлана уу</a>.</p>`
        : '';

    return `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0e11;font-family:'Helvetica Neue',Arial,system-ui,sans-serif">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0e11;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#17181c;border-radius:16px;overflow:hidden;max-width:600px;width:100%">
  <tr><td style="background:#000;padding:22px 32px;text-align:center">
    <a href="${this.siteUrl}" style="text-decoration:none;font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px">
      Best<span style="color:#e50914">TV</span>
    </a>
  </td></tr>
  <tr><td style="padding:32px 32px 8px">
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:800;color:#fff;line-height:1.35">${opts.heading}</h1>
    ${opts.bodyHtml}
  </td></tr>
  ${cta}
  <tr><td style="background:#101114;padding:20px 32px;text-align:center;border-top:1px solid #26272b">
    <p style="margin:0;font-size:12px;color:#777">© ${new Date().getFullYear()} BestTV · <a href="${this.siteUrl}" style="color:#999;text-decoration:none">besttv.us</a></p>
    ${unsub}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  }

  /** Дотоод мэдээллийн хайрцаг (захиалгын дэлгэрэнгүй гэх мэт) */
  private box(rows: [string, string][]): string {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1f24;border-radius:10px;margin:16px 0">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 16px;font-size:13px;color:#9a9aa0">${k}</td>
             <td style="padding:10px 16px;font-size:14px;color:#fff;font-weight:600;text-align:right">${v}</td></tr>`,
        )
        .join('')}
    </table>`;
  }

  private p = (t: string) =>
    `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#c8c8ce">${t}</p>`;

  // ─── Public template-ууд ────────────────────────────────────────────────────

  /** Бүртгэл амжилттай — тавтай морил */
  sendWelcome(opts: { to: string; name?: string | null; userId?: string }) {
    const html = this.layout({
      heading: `Тавтай морил${opts.name ? `, ${opts.name}` : ''}! 🎬`,
      preheader: 'BestTV-д тавтай морил — мянга мянган кино таныг хүлээж байна',
      bodyHtml:
        this.p('Таны BestTV бүртгэл амжилттай үүслээ.') +
        this.p(
          'Одооноос та үнэгүй кинонуудыг шууд үзэх боломжтой. Төлбөртэй контентыг үзэхийн тулд багц авах эсвэл киног ширхэгээр түрээслэнэ үү.',
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
        `<p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#777;word-break:break-all">
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
  }) {
    const html = this.layout({
      heading: opts.heading,
      bodyHtml: opts.bodyHtml,
      ctaText: opts.ctaText,
      ctaUrl: opts.ctaUrl,
      showUnsubscribe: true,
      email: opts.to,
    });
    this.queueSend({ to: opts.to, subject: opts.subject, html, template: 'marketing' });
  }
}
