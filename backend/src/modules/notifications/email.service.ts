import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly queue: Array<() => Promise<void>> = [];
  private draining = false;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('EMAIL_FROM') ?? 'noreply@digitalger.mn';
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) this.logger.warn('RESEND_API_KEY тохируулаагүй — имэйл явуулахгүй');
  }

  private isGuest(email: string): boolean {
    return email.endsWith('@guest.digitalger.mn');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !this.isGuest(email);
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue.push(task);
    if (!this.draining) void this.drain();
  }

  private async drain(): Promise<void> {
    this.draining = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
      if (this.queue.length > 0) await new Promise((r) => setTimeout(r, 300));
    }
    this.draining = false;
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.resend) return;
    if (!this.isValidEmail(to)) return;
    try {
      await this.resend.emails.send({ from: `DigitalGer <${this.from}>`, to, subject, html });
    } catch (err) {
      this.logger.error(`Имэйл явуулж чадсангүй → ${to}: ${err}`);
    }
  }

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
  <!-- Header -->
  <tr><td style="background:#022179;padding:28px 36px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:10px">
      <span style="background:#ffbe00;color:#022179;font-weight:900;font-size:16px;padding:6px 12px;border-radius:8px">DG</span>
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">DigitalGer</span>
    </div>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:36px 36px 0">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#022179">Захиалга баталгаажлаа ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555">${greeting}<br>Таны захиалга амжилттай бүртгэгдлээ.</p>
    <div style="background:#f8f9fb;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Захиалгын дугаар</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#022179;font-family:monospace">#${orderId.slice(-8).toUpperCase()}</p>
    </div>
    <!-- Items table -->
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
  <!-- CTA -->
  <tr><td style="padding:28px 36px;text-align:center">
    <a href="https://digitalger.mn/library" style="display:inline-block;background:#022179;color:#ffbe00;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
      Татаж авах →
    </a>
    <p style="margin:16px 0 0;font-size:13px;color:#888">Асуулт байвал: <a href="mailto:support@digitalger.mn" style="color:#022179">support@digitalger.mn</a></p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · digitalger.mn</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.enqueue(() => this.send(to, `Захиалга баталгаажлаа — #${orderId.slice(-8).toUpperCase()}`, html));
  }

  async sendEmailOtp(opts: {
    to: string;
    name: string | null;
    otp: string;
    purpose: 'verify' | 'reset';
  }) {
    const { to, name, otp, purpose } = opts;
    const greeting = name ? `Сайн байна уу, ${name}!` : 'Сайн байна уу!';
    const isReset = purpose === 'reset';
    const subject = isReset ? 'Нууц үг шинэчлэх — DigitalGer' : 'Имэйл баталгаажуулах — DigitalGer';
    const heading = isReset ? 'Нууц үг шинэчлэх' : 'Имэйл баталгаажуулах';
    const desc = isReset
      ? 'Нууц үгээ шинэчлэхийн тулд доорх нэг удаагийн кодыг оруулна уу.'
      : 'Имэйл хаягаа баталгаажуулахын тулд доорх нэг удаагийн кодыг оруулна уу.';

    const digits = otp.split('').map(
      (d) =>
        `<span style="display:inline-block;width:44px;height:54px;line-height:54px;text-align:center;font-size:28px;font-weight:900;color:#022179;background:#f0f4ff;border-radius:10px;margin:0 3px;letter-spacing:0">${d}</span>`,
    ).join('');

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  <!-- Header -->
  <tr><td style="background:#022179;padding:28px 36px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:10px">
      <span style="background:#ffbe00;color:#022179;font-weight:900;font-size:16px;padding:6px 12px;border-radius:8px">DG</span>
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">DigitalGer</span>
    </div>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 36px 32px;text-align:center">
    <div style="display:inline-block;background:${isReset ? '#fff7ed' : '#eff6ff'};border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:20px">
      ${isReset ? '🔑' : '✉️'}
    </div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#022179">${heading}</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#555">${greeting}</p>
    <p style="margin:0 0 32px;font-size:14px;color:#777">${desc}</p>
    <!-- OTP digits -->
    <div style="margin:0 auto 12px;display:block;text-align:center">
      ${digits}
    </div>
    <p style="margin:0 0 32px;font-size:12px;color:#aaa">Энэ код <strong>10 минутын</strong> дотор хүчинтэй.</p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 20px;text-align:left;margin-bottom:8px">
      <p style="margin:0;font-size:13px;color:#92400e">⚠️ Энэ кодыг хэн нэгэнд <strong>хэзээ ч хэлж болохгүй</strong>. DigitalGer ажилтнууд таны кодыг хэзээ ч асуухгүй.</p>
    </div>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0 0 4px;font-size:12px;color:#aaa">Хэрэв та энэ хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу.</p>
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · <a href="https://digitalger.mn" style="color:#022179;text-decoration:none">digitalger.mn</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.enqueue(() => this.send(to, subject, html));
  }

  async getStats(): Promise<{
    configured: boolean;
    sentThisMonth: number;
    sentLastMonth: number;
    sentTwoMonthsAgo: number;
    monthlyLimit: number;
    queueLength: number;
  }> {
    const queueLength = this.queue.length;
    const monthlyLimit = 3000;

    if (!this.resend) {
      return { configured: false, sentThisMonth: 0, sentLastMonth: 0, sentTwoMonthsAgo: 0, monthlyLimit, queueLength };
    }

    try {
      const now = new Date();
      const getMonthRange = (offset: number) => {
        const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
      };

      const fetchCount = async (offset: number) => {
        try {
          const { start, end } = getMonthRange(offset);
          const res = await (this.resend as any).emails.list({ limit: 100, from: start, to: end });
          return (res?.data?.data?.length ?? res?.data?.length ?? 0) as number;
        } catch {
          return 0;
        }
      };

      const [sentThisMonth, sentLastMonth, sentTwoMonthsAgo] = await Promise.all([
        fetchCount(0),
        fetchCount(1),
        fetchCount(2),
      ]);

      return { configured: true, sentThisMonth, sentLastMonth, sentTwoMonthsAgo, monthlyLimit, queueLength };
    } catch {
      return { configured: true, sentThisMonth: 0, sentLastMonth: 0, sentTwoMonthsAgo: 0, monthlyLimit, queueLength };
    }
  }

  async sendPaymentConfirmation(opts: {
    to: string;
    name: string | null;
    orderId: string;
    total: number;
  }) {
    const { to, name, orderId, total } = opts;
    const greeting = name ? `Сайн байна уу, ${name}!` : 'Сайн байна уу!';

    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%">
  <tr><td style="background:#022179;padding:28px 36px;text-align:center">
    <span style="background:#ffbe00;color:#022179;font-weight:900;font-size:16px;padding:6px 12px;border-radius:8px">DG</span>
    <span style="color:#fff;font-size:22px;font-weight:800;margin-left:10px">DigitalGer</span>
  </td></tr>
  <tr><td style="padding:36px">
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;text-align:center">✓</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#022179;text-align:center">Төлбөр амжилттай!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;text-align:center">${greeting}<br>₮${total.toLocaleString()} төлбөр амжилттай тооцогдлоо.</p>
    <div style="background:#f8f9fb;border-radius:10px;padding:16px 20px;margin-bottom:28px;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;color:#888">Захиалгын дугаар</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#022179;font-family:monospace">#${orderId.slice(-8).toUpperCase()}</p>
    </div>
    <div style="text-align:center">
      <a href="https://digitalger.mn/library" style="display:inline-block;background:#022179;color:#ffbe00;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
        Файлаа татах →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 36px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · digitalger.mn</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    this.enqueue(() => this.send(to, `Төлбөр амжилттай — ₮${total.toLocaleString()}`, html));
  }
}
