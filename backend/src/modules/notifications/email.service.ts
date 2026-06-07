import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Resend } from 'resend';
import Redis from 'ioredis';

const EMAIL_COUNT_KEY        = 'email:sent:count';        // AWS SES тоолуур
const EMAIL_RESEND_COUNT_KEY = 'email:resend:count';      // Resend тоолуур (тусдаа)
const EMAIL_QUEUE_KEY        = 'email:queue:length';

// Имэйл илгээх провайдер. AWS verify болоогүй тул түр Resend ашиглана.
// EMAIL_PROVIDER=resend (анхдагч) | ses — env-ээр сэлгэнэ, код дахин бичихгүй.
type EmailProvider = 'resend' | 'ses';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly ses: SESClient | null;
  private readonly resend: Resend | null;
  private readonly provider: EmailProvider;
  private readonly from: string;
  private readonly siteUrl: string;
  private readonly redis: Redis;
  private readonly queue: Array<() => Promise<unknown>> = [];
  private draining = false;

  constructor(private readonly config: ConfigService) {
    this.from       = this.config.get<string>('MAIL_FROM') ?? this.config.get<string>('EMAIL_FROM') ?? 'noreply@digitalger.mn';
    this.siteUrl    = this.config.get<string>('FRONTEND_URL') ?? 'https://digitalger.mn';
    const region    = this.config.get<string>('AWS_REGION') ?? 'eu-north-1';
    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    const redisUrl  = this.config.get<string>('redisUrl') ?? this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    // Провайдерийг env-ээс. Анхдагч 'resend' (AWS verify болоогүй).
    const rawProvider = (this.config.get<string>('EMAIL_PROVIDER') ?? 'resend').toLowerCase();
    this.provider = rawProvider === 'ses' ? 'ses' : 'resend';

    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });

    // ── Resend client ──
    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.logger.log(`Resend тохируулагдлаа — sender: ${this.from}`);
    } else {
      this.resend = null;
      if (this.provider === 'resend') {
        this.logger.warn('RESEND_API_KEY тохируулаагүй — Resend имэйл явуулахгүй');
      }
    }

    // ── AWS SES client (хадгалсан — verify болмогц EMAIL_PROVIDER=ses) ──
    if (accessKey && secretKey) {
      this.ses = new SESClient({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });
      this.logger.log(`AWS SES бэлэн (нөөц) — region: ${region}`);
    } else {
      this.ses = null;
    }

    this.logger.log(`Имэйлийн идэвхтэй провайдер: ${this.provider.toUpperCase()}`);
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
    } catch {
      // lazyConnect тул алдаа гарсан ч үргэлжилнэ
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  // Огноог "6-р сарын 7 өдөр, 21:23" хэлбэрээр (тоогоор сар, кирилл нэр биш).
  private formatMnDate(d: Date): string {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${month}-р сарын ${day} өдөр, ${hh}:${mm}`;
  }

  private emailHeader(): string {
    // Бодит PNG лого (DG badge биш) — frontend/public/brand/logo-white.png
    // Лого (height 40) + хажууд "DigitalGer.mn" цагаан title, table-аар голлуулж зэрэгцүүлэв.
    return `
  <tr><td style="background:#022179;padding:20px 36px;text-align:center">
    <a href="${this.siteUrl}" style="text-decoration:none;display:inline-block">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
        <td style="vertical-align:middle;padding-right:12px">
          <img src="${this.siteUrl}/brand/logo-white.png" alt="DigitalGer" height="40" style="height:40px;width:auto;display:block;border:0" />
        </td>
        <td style="vertical-align:middle">
          <span style="font-size:20px;font-weight:800;color:#ffffff;vertical-align:middle;font-family:Roboto,'Helvetica Neue',Arial,system-ui,sans-serif">DigitalGer.mn</span>
        </td>
      </tr></table>
    </a>
  </td></tr>`;
  }

  // ─── Дундын имэйл layout (бүх marketing/transactional template-д) ─────────────
  // Гоё, найдвартай (table-based, бүх email client дэмжинэ), лого/footer/pixel.
  private emailLayout(opts: {
    heading: string;       // гол гарчиг (body эхэнд)
    bodyHtml: string;      // дунд хэсэг (HTML)
    ctaText?: string;      // CTA товчны текст
    ctaUrl?: string;       // CTA холбоос
    preheader?: string;    // inbox preview текст
    campaign?: string;     // tracking pixel campaign нэр
    email?: string;        // pixel-д хэрэглэгчийн имэйл
    refId?: string;        // pixel refId (order/coupon/product)
    showUnsubscribe?: boolean; // marketing имэйлд unsubscribe footer
  }): string {
    const cta = opts.ctaText && opts.ctaUrl
      ? `<tr><td style="padding:8px 36px 28px;text-align:center">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:#022179;color:#ffbe00;font-weight:800;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none">${opts.ctaText}</a>
         </td></tr>`
      : '';
    // Tracking pixel (1×1) — нээлт хянана
    const pixel = opts.campaign && opts.email
      ? `<img src="${this.siteUrl.replace('digitalger.mn', 'api.digitalger.mn')}/api/email/open?c=${encodeURIComponent(opts.campaign)}&e=${encodeURIComponent(opts.email)}${opts.refId ? `&r=${encodeURIComponent(opts.refId)}` : ''}" width="1" height="1" alt="" style="display:none;width:1px;height:1px" />`
      : '';
    const unsub = opts.showUnsubscribe && opts.email
      ? `<p style="margin:8px 0 0;font-size:11px;color:#bbb">Эдгээр имэйлийг авахыг хүсэхгүй бол <a href="${this.siteUrl}/unsubscribe?email=${encodeURIComponent(opts.email)}" style="color:#999;text-decoration:underline">энд дарж цуцлана уу</a>.</p>`
      : '';
    const pre = opts.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
      : '';

    return `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Roboto,'Helvetica Neue',Arial,system-ui,sans-serif">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  ${this.emailHeader()}
  <tr><td style="padding:34px 36px 4px">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#022179;line-height:1.3">${opts.heading}</h1>
    ${opts.bodyHtml}
  </td></tr>
  ${cta}
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · <a href="${this.siteUrl}" style="color:#aaa;text-decoration:none">digitalger.mn</a></p>
    ${unsub}
  </td></tr>
</table>
</td></tr></table>
${pixel}
</body></html>`;
  }

  private isGuest(email: string): boolean {
    return email.endsWith('@guest.digitalger.mn');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !this.isGuest(email);
  }

  private enqueue(task: () => Promise<unknown>): void {
    this.queue.push(task);
    this.redis.set(EMAIL_QUEUE_KEY, this.queue.length).catch(() => {});
    if (!this.draining) void this.drain();
  }

  private async drain(): Promise<void> {
    this.draining = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.redis.set(EMAIL_QUEUE_KEY, this.queue.length).catch(() => {});
      await task();
      if (this.queue.length > 0) await new Promise((r) => setTimeout(r, 300));
    }
    this.redis.set(EMAIL_QUEUE_KEY, 0).catch(() => {});
    this.draining = false;
  }

  // Имэйл амжилттай явсан эсэхийг буцаана (true=амжилттай, false=алдаа/явсангүй).
  // subscribe урсгал энэ утгаар имэйл хүчинтэй эсэхийг шийднэ.
  private async send(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
    if (!this.isValidEmail(to)) return false;

    this.logger.log(`Имэйл боловсруулж байна (${this.provider}) → ${to} | ${subject}`);

    // ── Resend (идэвхтэй провайдер) ──
    if (this.provider === 'resend') {
      if (!this.resend) {
        this.logger.warn(`Resend тохируулаагүй — имэйл алгассан → ${to}`);
        return false;
      }
      try {
        const { error } = await this.resend.emails.send({
          from: `DigitalGer <${this.from}>`,
          to: [to],
          subject,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        if (error) {
          this.logger.error(`Resend имэйл явуулж чадсангүй → ${to}: ${JSON.stringify(error)}`);
          return false;
        }
        await this.bumpCounter(EMAIL_RESEND_COUNT_KEY);
        this.logger.log(`Resend имэйл амжилттай илгээгдлээ → ${to}`);
        return true;
      } catch (err) {
        this.logger.error(`Resend имэйл явуулж чадсангүй → ${to}: ${err}`);
        return false;
      }
    }

    // ── AWS SES (нөөц провайдер) ──
    if (!this.ses) {
      this.logger.warn(`AWS SES тохируулаагүй — имэйл алгассан → ${to}`);
      return false;
    }
    try {
      await this.ses.send(
        new SendEmailCommand({
          Source: `DigitalGer <${this.from}>`,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body:    { Html: { Data: html,    Charset: 'UTF-8' } },
          },
        }),
      );
      await this.bumpCounter(EMAIL_COUNT_KEY);
      this.logger.log(`AWS SES имэйл амжилттай илгээгдлээ → ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`AWS SES имэйл явуулж чадсангүй → ${to}: ${err}`);
      return false;
    }
  }

  // Redis-д тухайн провайдерийн энэ сарын тоолуурыг нэмнэ (~3 сар хадгална)
  private async bumpCounter(baseKey: string): Promise<void> {
    const monthKey = `${baseKey}:${this.currentMonthSlug()}`;
    await this.redis.incr(monthKey).catch(() => {});
    await this.redis.expire(monthKey, 60 * 60 * 24 * 95).catch(() => {});
  }

  private currentMonthSlug(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthSlug(offset: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ─── public email methods ────────────────────────────────────────────────────

  async sendOrderConfirmation(opts: {
    to: string;
    name: string | null;
    orderId: string;
    items: { title: string; price: number }[];
    total: number;
    couponCode?: string | null;
  }) {
    const { to, name, orderId, items, total, couponCode } = opts;
    const greeting = name ? `Сайн байна уу, ${name}!` : 'Сайн байна уу!';
    const rows = items
      .map(
        (i) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${i.title}</td>
           <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;white-space:nowrap">₮${i.price.toLocaleString()}</td></tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  ${this.emailHeader()}
  <!-- Body -->
  <tr><td style="padding:36px 36px 0">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#022179">Захиалга баталгаажлаа ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555">${greeting}<br>Таны захиалга амжилттай бүртгэгдлээ.</p>
    <div style="background:#f8f9fb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Захиалгын дугаар</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#022179;font-family:monospace">#${orderId.slice(-8).toUpperCase()}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr><th style="text-align:left;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;border-bottom:2px solid #022179">Бүтээгдэхүүн</th>
          <th style="text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;border-bottom:2px solid #022179">Үнэ</th></tr>
      ${rows}
    </table>
    ${couponCode ? `<p style="font-size:13px;color:#555;margin:0 0 4px">Купон: <strong>${couponCode}</strong></p>` : ''}
    <div style="display:flex;justify-content:flex-end;border-top:2px solid #022179;padding-top:12px;margin-top:4px">
      <p style="margin:0;font-size:18px;font-weight:800;color:#022179">Нийт: ₮${total.toLocaleString()}</p>
    </div>
  </td></tr>
  <tr><td style="padding:28px 36px;text-align:center">
    <a href="${this.siteUrl}/library" style="display:inline-block;background:#022179;color:#ffbe00;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
      Татаж авах →
    </a>
    <p style="margin:16px 0 0;font-size:13px;color:#888">Асуулт байвал: <a href="mailto:support@digitalger.mn" style="color:#022179">support@digitalger.mn</a></p>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · <a href="${this.siteUrl}" style="color:#aaa;text-decoration:none">digitalger.mn</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.logger.log(`Захиалгын имэйл дараалалд оруулав → ${to} | #${orderId.slice(-8).toUpperCase()}`);
    this.enqueue(() => this.send(to, `Захиалга баталгаажлаа — #${orderId.slice(-8).toUpperCase()}`, html));
  }

  // ─── Newsletter subscribe → 10% coupon + үнэгүй product welcome имэйл ──────────
  // @returns имэйл амжилттай явсан эсэх (false бол имэйл хүчингүй болж магадгүй).
  async sendWelcomeCoupon(opts: { to: string; couponCode: string; discountPercent: number }): Promise<boolean> {
    const { to, couponCode, discountPercent } = opts;
    const freeUrl = `${this.siteUrl}/products/font-canva-powerpoint-free`;

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  ${this.emailHeader()}
  <!-- Welcome -->
  <tr><td style="padding:36px 36px 0;text-align:center">
    <p style="font-size:40px;margin:0 0 8px">🎁</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#022179">Тавтай морилно уу!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555">Манай мэдээллийн жагсаалтад бүртгүүлсэнд баярлалаа. Танд бэлэг байна 👇</p>
  </td></tr>
  <!-- 1) Coupon хэсэг -->
  <tr><td style="padding:0 36px 8px">
    <div style="background:linear-gradient(135deg,#022179,#0a3aa0);border-radius:14px;padding:24px;text-align:center">
      <p style="margin:0 0 6px;font-size:13px;color:#ffbe00;text-transform:uppercase;letter-spacing:1px;font-weight:700">${discountPercent}% ХӨНГӨЛӨЛТ</p>
      <p style="margin:0 0 12px;font-size:13px;color:#cdd8f0">Эхний худалдан авалтдаа ашиглаарай</p>
      <div style="background:#ffffff;border-radius:10px;padding:14px;display:inline-block">
        <span style="font-family:monospace;font-size:24px;font-weight:800;color:#022179;letter-spacing:2px">${couponCode}</span>
      </div>
    </div>
  </td></tr>
  <!-- 2) Үнэгүй бүтээгдэхүүн хэсэг -->
  <tr><td style="padding:20px 36px 0">
    <div style="border:1px solid #ffe9a8;background:#fffbef;border-radius:14px;padding:20px">
      <p style="margin:0 0 4px;font-size:12px;color:#a07b00;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">🎉 Үнэгүй бэлэг</p>
      <h2 style="margin:0 0 6px;font-size:17px;font-weight:800;color:#022179">1300 Font + 200 Canva + 100 PowerPoint</h2>
      <p style="margin:0 0 14px;font-size:14px;color:#666">Дизайн, бизнес танилцуулга, сошиал медиад хэрэгтэй 1600+ материалыг бүртгэлгүйгээр ҮНЭГҮЙ татаж аваарай.</p>
      <a href="${freeUrl}" style="display:inline-block;background:#ffbe00;color:#022179;font-weight:800;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">
        Үнэгүй татах →
      </a>
    </div>
  </td></tr>
  <tr><td style="padding:24px 36px;text-align:center">
    <a href="${this.siteUrl}/products" style="display:inline-block;background:#022179;color:#ffbe00;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
      Бүх бүтээгдэхүүн үзэх →
    </a>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · <a href="${this.siteUrl}" style="color:#aaa;text-decoration:none">digitalger.mn</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.logger.log(`Welcome coupon имэйл илгээж байна → ${to} | ${couponCode}`);
    // ШУУД илгээнэ (queue биш) — амжилт буцаана. subscribe урсгал имэйл
    // хүчинтэй эсэхийг (явсан/явсангүй) энэ утгаар шийдэж invalid тэмдэглэнэ.
    return this.send(to, `🎁 Тавтай морилно уу — ${discountPercent}% хөнгөлөлт + үнэгүй бэлэг`, html);
  }

  // ═══ MARKETING AUTOMATION TEMPLATES ═════════════════════════════════════════
  private itemRows(items: { title: string; price: number }[]): string {
    // Cart reminder-ийн бүтээгдэхүүний мөр — тод background, нэр bold, текст хар.
    return items
      .map(
        (i) =>
          `<tr><td style="padding:12px 16px;background:#f8f9fb;border:1px solid #e6e9f0;border-right:0;border-radius:8px 0 0 8px;font-size:14px;font-weight:600;color:#1a1a1a">${i.title}</td>
           <td style="padding:12px 16px;background:#f8f9fb;border:1px solid #e6e9f0;border-left:0;border-radius:0 8px 8px 0;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;white-space:nowrap">₮${i.price.toLocaleString()}</td></tr>
           <tr><td colspan="2" style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>`,
      )
      .join('');
  }

  /** 1. Cart abandonment (1ц) — худалдан авалт дуусгаагүй сануулга. */
  async sendCartReminder(opts: { to: string; name: string | null; orderId: string; items: { title: string; price: number }[]; total: number }) {
    const greeting = opts.name ? `Сайн байна уу, ${opts.name}!` : 'Сайн байна уу!';
    const body = `
      <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a">${greeting}<br>Таны сонгосон бүтээгдэхүүн сагсанд хүлээж байна 👀 Худалдан авалтаа дуусгаж шууд татаж аваарай.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">${this.itemRows(opts.items)}</table>
      <div style="border-top:2px solid #022179;padding-top:12px;margin-top:4px;text-align:right">
        <span style="font-size:17px;font-weight:800;color:#022179">Нийт: ₮${opts.total.toLocaleString()}</span>
      </div>`;
    const html = this.emailLayout({
      heading: 'Таны сонгосон бүтээгдэхүүн таныг хүлээж байна 👀',
      bodyHtml: body,
      ctaText: 'Худалдан авалтаа дуусгах →',
      ctaUrl: `${this.siteUrl}/checkout`,
      preheader: 'Сагсанд байгаа бүтээгдэхүүнээ авч амжаарай',
      campaign: 'cart-1h', email: opts.to, refId: opts.orderId, showUnsubscribe: true,
    });
    this.enqueue(() => this.send(opts.to, 'Таны сонгосон бүтээгдэхүүн таныг хүлээж байна 👀', html));
  }

  /** 2. Discount push (24ц) — аваагүй хэрэглэгчид 10% coupon follow-up. */
  async sendDiscountPush(opts: { to: string; name: string | null; orderId: string; couponCode: string; discountPercent: number }) {
    const greeting = opts.name ? `Сайн байна уу, ${opts.name}!` : 'Сайн байна уу!';
    const body = `
      <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a">${greeting}<br>Таны сонирхсон бүтээгдэхүүн хүлээсээр байна. Танд тусгай бэлэг бэлдлээ 🎁</p>
      <div style="background:linear-gradient(135deg,#1e40af,#3b5bdb);border-radius:14px;padding:24px;text-align:center;margin-bottom:8px">
        <p style="margin:0 0 6px;font-size:13px;color:#ffbe00;text-transform:uppercase;letter-spacing:1px;font-weight:700">${opts.discountPercent}% ХӨНГӨЛӨЛТ</p>
        <div style="background:#fff;border-radius:10px;padding:14px;display:inline-block">
          <span style="font-family:monospace;font-size:24px;font-weight:800;color:#022179;letter-spacing:2px">${opts.couponCode}</span>
        </div>
        <p style="margin:12px 0 0;font-size:12px;color:#e3e9fb">Худалдан авалт хийхдээ энэ купоныг хуулж купон оруулах хэсэгт оруулж идэвхжүүлээрэй!</p>
      </div>`;
    const html = this.emailLayout({
      heading: 'Танд 10% хөнгөлөлт бэлэглэж байна 🎁',
      bodyHtml: body,
      ctaText: 'Хямдралтай авах →',
      ctaUrl: `${this.siteUrl}/checkout`,
      preheader: `${opts.discountPercent}% хөнгөлөлтийн код таныг хүлээж байна`,
      campaign: 'discount-24h', email: opts.to, refId: opts.orderId, showUnsubscribe: true,
    });
    this.enqueue(() => this.send(opts.to, '🎁 Танд 10% хөнгөлөлт бэлэглэж байна', html));
  }

  /** 3. Expiring coupon (12ц өмнө) — coupon удахгүй дуусна сануулга. */
  async sendExpiringCoupon(opts: { to: string; name: string | null; couponCode: string; discountLabel: string; expiresAt: Date; couponId?: string }) {
    const greeting = opts.name ? `Сайн байна уу, ${opts.name}!` : 'Сайн байна уу!';
    const exp = this.formatMnDate(new Date(opts.expiresAt));
    const body = `
      <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a">${greeting}<br>Та амжиж ашиглаарай! Таны <strong>${opts.couponCode}</strong> хөнгөлөлтийн код удахгүй дуусах гэж байна.</p>
      <div style="background:#fffbef;border:1px solid #ffe9a8;border-radius:14px;padding:20px;text-align:center;margin-bottom:8px">
        <p style="margin:0 0 8px;font-size:13px;color:#a07b00;font-weight:700">${opts.discountLabel}</p>
        <span style="font-family:monospace;font-size:22px;font-weight:800;color:#022179;letter-spacing:2px">${opts.couponCode}</span>
        <p style="margin:14px 0 0;font-size:14px;color:#1a1a1a;font-weight:600">⏰ Дуусах хугацаа: <span style="color:#c0392b">${exp}</span></p>
      </div>`;
    const html = this.emailLayout({
      heading: '⏰ Танд бэлэглэсэн хөнгөлөлтийн купон дуусаж байна',
      bodyHtml: body,
      ctaText: 'Одоо ашиглах →',
      ctaUrl: `${this.siteUrl}/products`,
      preheader: 'Хөнгөлөлтийн кодоо ашиглаж амжаарай',
      campaign: 'coupon-expiring', email: opts.to, refId: opts.couponId, showUnsubscribe: true,
    });
    this.enqueue(() => this.send(opts.to, '⏰ Танд бэлэглэсэн хөнгөлөлтийн купон дуусаж байна', html));
  }

  /** 4. New product notification — subscriber-уудад шинэ бүтээгдэхүүн. */
  async sendNewProduct(opts: { to: string; productTitle: string; productSlug: string; price: number; salePrice?: number | null; imageUrl?: string | null }) {
    const eff = opts.salePrice != null && opts.salePrice >= 0 ? opts.salePrice : opts.price;
    const priceLabel = eff === 0 ? 'ҮНЭГҮЙ 🎁' : `₮${eff.toLocaleString()}`;
    const img = opts.imageUrl
      ? `<tr><td style="padding:0 0 16px"><img src="${opts.imageUrl}" alt="${opts.productTitle}" width="528" style="width:100%;max-width:528px;border-radius:12px;display:block" /></td></tr>`
      : '';
    const body = `
      <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a">Манайд шинэ бүтээгдэхүүн нэмэгдлээ! Хамгийн түрүүнд танилцаарай 👇</p>
      <div style="background:#f5f8ff;border:1px solid #e3e9fb;border-radius:14px;padding:20px;text-align:center">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${img}
          <tr><td style="text-align:center">
            <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#022179;line-height:1.4">${opts.productTitle}</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:${eff === 0 ? '#16a34a' : '#022179'}">${priceLabel}</p>
          </td></tr>
        </table>
      </div>`;
    const html = this.emailLayout({
      heading: '🆕 Шинэ бүтээгдэхүүн нэмэгдлээ',
      bodyHtml: body,
      ctaText: 'Үзэх →',
      ctaUrl: `${this.siteUrl}/products/${opts.productSlug}`,
      preheader: opts.productTitle,
      campaign: 'new-product', email: opts.to, refId: opts.productSlug, showUnsubscribe: true,
    });
    this.enqueue(() => this.send(opts.to, `🆕 Шинэ: ${opts.productTitle}`, html));
  }

  /** 5. Inactive user reactivation (30 хоног) — буцаан татах + coupon. */
  async sendReactivation(opts: { to: string; name: string | null; couponCode: string; discountLabel: string }) {
    const greeting = opts.name ? `Сайн байна уу, ${opts.name}!` : 'Сайн байна уу!';
    const body = `
      <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a">${greeting}<br>Таныг DigitalGer.mn дээр эргэн ирэхэд тань зориулж тусгай хөнгөлөлтийн бэлэг илгээж байна.</p>
      <div style="background:linear-gradient(135deg,#1e40af,#3b5bdb);border-radius:14px;padding:24px;text-align:center;margin-bottom:8px">
        <p style="margin:0 0 6px;font-size:13px;color:#ffbe00;text-transform:uppercase;letter-spacing:1px;font-weight:700">${opts.discountLabel}</p>
        <div style="background:#fff;border-radius:10px;padding:14px;display:inline-block">
          <span style="font-family:monospace;font-size:24px;font-weight:800;color:#022179;letter-spacing:2px">${opts.couponCode}</span>
        </div>
      </div>`;
    const html = this.emailLayout({
      heading: 'Таныг бид хүлээсээр байна 👋',
      bodyHtml: body,
      ctaText: 'Шинэ бүтээгдэхүүн үзэх →',
      ctaUrl: `${this.siteUrl}/products`,
      preheader: 'Эргэн ирэхэд тань зориулсан тусгай хөнгөлөлт',
      campaign: 'reactivation', email: opts.to, showUnsubscribe: true,
    });
    this.enqueue(() => this.send(opts.to, 'Таныг бид хүлээсээр байна 👋', html));
  }

  /** Имэйл нээлт (pixel) бүртгэх. */
  async recordEmailOpen(campaign: string, email: string, refId?: string) {
    if (!campaign || !email) return;
    await this.redis.incr(`email:open:${campaign}`).catch(() => {});
  }

  // ─── Холбоо барих (inquiry) → info@digitalger.mn ──────────────────────────────
  async sendContactInquiry(opts: { name: string; email: string; phone?: string; message: string }) {
    const { name, email, phone, message } = opts;
    const to = 'info@digitalger.mn';
    const safe = (s: string) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  ${this.emailHeader()}
  <tr><td style="padding:36px 36px 0">
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#022179">📩 Шинэ холбоо барих хүсэлт</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#777">Вэбсайтаас ирсэн мессеж:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;width:90px">Нэр</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;font-weight:600">${safe(name)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888">И-мэйл</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222"><a href="mailto:${safe(email)}" style="color:#022179">${safe(email)}</a></td></tr>
      ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888">Утас</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222">${safe(phone)}</td></tr>` : ''}
    </table>
    <div style="background:#f8f9fb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Мессеж</p>
      <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${safe(message)}</p>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">DigitalGer холбоо барих маягт</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.logger.log(`Contact inquiry имэйл дараалалд → ${to} | from ${email}`);
    // replyTo тавьж хариу шууд илгээгчид очдог болгоно (Resend дэмждэг)
    this.enqueue(() => this.send(to, `📩 Холбоо барих — ${name}`, html, email));
  }

  async sendEmailOtp(opts: {
    to: string;
    name: string | null;
    otp: string;
    purpose: 'verify' | 'reset' | 'email_change';
  }) {
    const { to, name, otp, purpose } = opts;
    const greeting  = name ? `Сайн байна уу, ${name}!` : 'Сайн байна уу!';
    const isReset   = purpose === 'reset';
    const subject   = isReset ? 'Нууц үг шинэчлэх — DigitalGer' : 'Имэйл баталгаажуулах — DigitalGer';
    const heading   = isReset ? 'Нууц үг шинэчлэх' : 'Имэйл баталгаажуулах';
    const desc      = isReset
      ? 'Нууц үгээ шинэчлэхийн тулд доорх нэг удаагийн кодыг оруулна уу.'
      : 'Имэйл хаягаа баталгаажуулахын тулд доорх нэг удаагийн кодыг оруулна уу.';

    const digitCells = otp.split('').map(
      (d) =>
        `<td style="padding:0 4px"><div style="width:44px;height:54px;line-height:54px;text-align:center;font-size:28px;font-weight:900;color:#022179;background:#f0f4ff;border-radius:10px">${d}</div></td>`,
    ).join('');

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  ${this.emailHeader()}
  <tr><td style="padding:40px 36px 32px;text-align:center">
    <div style="display:inline-block;background:${isReset ? '#fff7ed' : '#eff6ff'};border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:20px">
      ${isReset ? '🔑' : '✉️'}
    </div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#022179">${heading}</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#555">${greeting}</p>
    <p style="margin:0 0 32px;font-size:14px;color:#777">${desc}</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px">
      <tr>${digitCells}</tr>
    </table>
    <p style="margin:0 0 32px;font-size:12px;color:#aaa">Энэ код <strong>10 минутын</strong> дотор хүчинтэй.</p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 20px;text-align:left;margin-bottom:8px">
      <p style="margin:0;font-size:13px;color:#92400e">⚠️ Энэ кодыг хэн нэгэнд <strong>хэзээ ч хэлж болохгүй</strong>. DigitalGer ажилтнууд таны кодыг хэзээ ч асуухгүй.</p>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0 0 4px;font-size:12px;color:#aaa">Хэрэв та энэ хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу.</p>
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · <a href="${this.siteUrl}" style="color:#aaa;text-decoration:none">digitalger.mn</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.logger.log(`OTP имэйл дараалалд оруулав → ${to} | ${purpose}`);
    this.enqueue(() => this.send(to, subject, html));
  }

  async sendPaymentConfirmation(opts: {
    to: string;
    name: string | null;
    orderId: string;
    total: number;
    items?: { title: string; price: number }[];
  }) {
    const { to, name, orderId, total, items = [] } = opts;
    const greeting = name ? `Сайн байна уу, ${name}!` : 'Сайн байна уу!';

    // Худалдан авсан бүтээгдэхүүний жагсаалт (нэр + үнэ)
    const rows = items
      .map(
        (i) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${i.title}</td>
           <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;white-space:nowrap">₮${i.price.toLocaleString()}</td></tr>`,
      )
      .join('');

    const itemsBlock = items.length
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><th style="text-align:left;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:2px solid #022179">Худалдан авсан бүтээгдэхүүн</th>
          <th style="text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:2px solid #022179">Үнэ</th></tr>
      ${rows}
    </table>`
      : '';

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  ${this.emailHeader()}
  <tr><td style="padding:36px">
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;text-align:center">✓</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#022179;text-align:center">Төлбөр амжилттай!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;text-align:center">${greeting}<br>Таны худалдан авалт амжилттай баталгаажлаа.</p>
    <div style="background:#f8f9fb;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;color:#888">Захиалгын дугаар</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#022179;font-family:monospace">#${orderId.slice(-8).toUpperCase()}</p>
    </div>
    ${itemsBlock}
    <div style="border-top:2px solid #022179;padding-top:12px;margin-bottom:24px;text-align:right">
      <p style="margin:0;font-size:18px;font-weight:800;color:#022179">Нийт төлсөн: ₮${total.toLocaleString()}</p>
    </div>
    <!-- Миний сан тайлбар -->
    <div style="background:#f0f4ff;border:1px solid #d6e0ff;border-radius:10px;padding:16px 20px;margin-bottom:28px">
      <p style="margin:0;font-size:14px;color:#1e3a8a;line-height:1.6">📁 Таны худалдан авсан бүтээгдэхүүн нь хэрэглэгчийн <strong>«Миний сан»</strong> хэсэгт байрласан ба та тэндээс дэлгэрэнгүй болно.</p>
    </div>
    <div style="text-align:center">
      <a href="${this.siteUrl}/library" style="display:inline-block;background:#022179;color:#ffbe00;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
        Миний сан руу очих →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · <a href="${this.siteUrl}" style="color:#aaa;text-decoration:none">digitalger.mn</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.logger.log(`Төлбөрийн имэйл дараалалд оруулав → ${to} | ₮${total.toLocaleString()}`);
    this.enqueue(() => this.send(to, `Төлбөр амжилттай — ₮${total.toLocaleString()}`, html));
  }

  // ─── stats (Redis-ийн тоолуур) ────────────────────────────────────────────

  // Тухайн base key-ийн сүүлийн 3 сарын тоог Redis-ээс уншина.
  private async readMonthlyCounts(baseKey: string): Promise<[number, number, number]> {
    const getCount = async (offset: number): Promise<number> => {
      try {
        const key = `${baseKey}:${this.monthSlug(offset)}`;
        const val = await this.redis.get(key);
        return val ? parseInt(val, 10) : 0;
      } catch {
        return 0;
      }
    };
    return Promise.all([getCount(0), getCount(1), getCount(2)]);
  }

  // AWS SES статистик (admin dashboard-ийн 'Имэйл хяналт' карт)
  async getStats(): Promise<{
    configured: boolean;
    sentThisMonth: number;
    sentLastMonth: number;
    sentTwoMonthsAgo: number;
    monthlyLimit: number;
    queueLength: number;
    provider: string;
    active: boolean;
  }> {
    const [sentThisMonth, sentLastMonth, sentTwoMonthsAgo] =
      await this.readMonthlyCounts(EMAIL_COUNT_KEY);

    return {
      configured: this.ses !== null,
      sentThisMonth,
      sentLastMonth,
      sentTwoMonthsAgo,
      monthlyLimit: 50000, // AWS SES лимит
      queueLength: this.queue.length,
      provider: 'AWS SES',
      active: this.provider === 'ses', // одоо идэвхтэй провайдер эсэх
    };
  }

  // Resend статистик (admin dashboard-ийн 'Resend хяналт' карт)
  async getResendStats(): Promise<{
    configured: boolean;
    sentThisMonth: number;
    sentLastMonth: number;
    sentTwoMonthsAgo: number;
    monthlyLimit: number;
    queueLength: number;
    provider: string;
    active: boolean;
  }> {
    const [sentThisMonth, sentLastMonth, sentTwoMonthsAgo] =
      await this.readMonthlyCounts(EMAIL_RESEND_COUNT_KEY);

    return {
      configured: this.resend !== null,
      sentThisMonth,
      sentLastMonth,
      sentTwoMonthsAgo,
      monthlyLimit: 3000, // Resend free tier (сард 3000)
      queueLength: this.queue.length,
      provider: 'Resend',
      active: this.provider === 'resend', // одоо идэвхтэй провайдер эсэх
    };
  }
}
