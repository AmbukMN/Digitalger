import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { get as httpsGet } from 'https';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { verifySnsSignature } from './sns-signature.util';

/** unknown утгыг найдвартай string болгоно (object → '', primitive → String). */
function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/**
 * AWS SNS → SES bounce / complaint / delivery webhook.
 *
 * SES нь bounce/complaint/delivery эвентийг SNS topic-руу нийтэлдэг. SNS энэ
 * controller-руу HTTP POST хийнэ. Public endpoint (SNS дуудна, JWT биш) тул
 * ⚠️ SIGNATURE VALIDATION ЗААВАЛ — хуурамч хүсэлтээс хамгаална.
 *
 * Урсгал:
 *   - SubscriptionConfirmation → SubscribeURL автомат GET (topic баталгаажуулна).
 *   - Notification → дотор Message (SES эвент) parse:
 *       Bounce (Permanent)  → suppression нэмэх + EmailLog bouncedAt.
 *       Complaint           → suppression + Subscriber UNSUBSCRIBED + complainedAt.
 *       Delivery            → EmailLog status='delivered', deliveredAt.
 *
 * Body нь Content-Type: text/plain ирдэг тул (express.json parse хийхгүй)
 * rawBody-оос гараар JSON.parse хийнэ (main.ts-д rawBody:true).
 */
@SkipThrottle()
@Controller('ses')
export class SesWebhookController {
  private readonly logger = new Logger(SesWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Post('webhook')
  @HttpCode(200) // SNS 200-аас өөр код авбал дахин дахин дуудна.
  async webhook(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean }> {
    // ── 1. Body-г уншина (rawBody эсвэл аль хэдийн parse хийсэн body) ──
    let payload: Record<string, unknown>;
    try {
      const raw = req.rawBody?.toString('utf8');
      if (raw && raw.trim()) {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } else if (req.body && typeof req.body === 'object') {
        payload = req.body as Record<string, unknown>;
      } else {
        this.logger.warn('SNS webhook — хоосон body');
        return { ok: false };
      }
    } catch (err) {
      this.logger.warn(`SNS webhook — body parse алдаа: ${err}`);
      return { ok: false };
    }

    // ── 2. ⚠️ Signature validation (security) — хуурамч webhook хамгаалалт ──
    const valid = await verifySnsSignature(payload);
    if (!valid) {
      this.logger.warn(
        'SNS webhook — signature ХҮЧИНГҮЙ, хүсэлтийг үл тоомсорлов',
      );
      return { ok: false };
    }

    const type = str(payload.Type);

    // ── 3. SubscriptionConfirmation → SubscribeURL автомат баталгаажуулна ──
    if (type === 'SubscriptionConfirmation') {
      const subUrl = str(payload.SubscribeURL);
      if (subUrl) {
        await this.confirmSubscription(subUrl);
        this.logger.log('SNS subscription баталгаажуулав');
      }
      return { ok: true };
    }

    // ── 4. Notification → SES эвент боловсруулна ──
    if (type === 'Notification') {
      await this.handleNotification(payload).catch((err) =>
        this.logger.error(`SNS notification боловсруулах алдаа: ${err}`),
      );
      return { ok: true };
    }

    // UnsubscribeConfirmation гэх мэт — алгасна (200 буцаана).
    return { ok: true };
  }

  /** SubscribeURL-г GET хийж SNS topic баталгаажуулна. */
  private confirmSubscription(url: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const u = new URL(url);
        // Зөвхөн AWS SNS домэйн зөвшөөрнө (SSRF хамгаалалт).
        if (
          !/^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(
            u.hostname.toLowerCase(),
          )
        ) {
          this.logger.warn(
            `SubscribeURL AWS бус домэйн — алгаслаа: ${u.hostname}`,
          );
          resolve();
          return;
        }
        httpsGet(url, (res) => {
          res.resume(); // body уншиж дуусгана
          res.on('end', () => resolve());
        }).on('error', (e) => {
          this.logger.warn(`SubscribeURL GET алдаа: ${e}`);
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  /** SES эвент (Message доторх JSON) parse → bounce/complaint/delivery. */
  private async handleNotification(
    payload: Record<string, unknown>,
  ): Promise<void> {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(str(payload.Message) || '{}') as Record<
        string,
        unknown
      >;
    } catch {
      this.logger.warn('SNS Message JSON parse алдаа');
      return;
    }

    const notificationType =
      str(message.notificationType) || str(message.eventType);
    const mail = (message.mail as Record<string, unknown>) ?? {};
    const messageId = str(mail.messageId);

    // ── Bounce ──
    if (notificationType === 'Bounce') {
      const bounce = (message.bounce as Record<string, unknown>) ?? {};
      const bounceType = str(bounce.bounceType); // Permanent | Transient | Undetermined
      const bounceSubType = str(bounce.bounceSubType);
      const recipients =
        (bounce.bouncedRecipients as Array<Record<string, unknown>>) ?? [];

      if (messageId) await this.email.markLogStatus(messageId, 'bounced');

      // ⚠️ Зөвхөн Permanent bounce → suppression (Transient бол түр алдаа, дахин явж болно).
      if (bounceType === 'Permanent') {
        for (const r of recipients) {
          const addr = str(r.emailAddress).trim();
          if (!addr) continue;
          await this.email.addSuppression({
            email: addr,
            reason: 'bounce',
            subType: bounceSubType || bounceType,
            detail: str(r.diagnosticCode) || str(bounce.bounceSubType),
          });
        }
      }
      this.logger.log(
        `SES Bounce (${bounceType}/${bounceSubType}) — ${recipients.length} хүлээн авагч`,
      );
      return;
    }

    // ── Complaint ──
    if (notificationType === 'Complaint') {
      const complaint = (message.complaint as Record<string, unknown>) ?? {};
      const subType = str(complaint.complaintFeedbackType) || 'abuse';
      const recipients =
        (complaint.complainedRecipients as Array<Record<string, unknown>>) ??
        [];

      if (messageId) await this.email.markLogStatus(messageId, 'complained');

      for (const r of recipients) {
        const addr = str(r.emailAddress).trim().toLowerCase();
        if (!addr) continue;
        // Suppression + Subscriber UNSUBSCRIBED (дахин marketing явуулахгүй).
        await this.email.addSuppression({
          email: addr,
          reason: 'complaint',
          subType,
          detail: subType,
        });
        await this.prisma.subscriber
          .updateMany({
            where: { email: addr },
            data: { status: 'UNSUBSCRIBED' },
          })
          .catch(() => null);
        await this.prisma.user
          .updateMany({
            where: { email: addr },
            data: { marketingOptOut: true },
          })
          .catch(() => null);
      }
      this.logger.log(
        `SES Complaint (${subType}) — ${recipients.length} хүлээн авагч suppress+unsubscribe`,
      );
      return;
    }

    // ── Delivery ──
    if (notificationType === 'Delivery') {
      if (messageId) {
        await this.email.markLogStatus(messageId, 'delivered');
        this.logger.log(`SES Delivery — ${messageId}`);
      }
      return;
    }

    this.logger.debug(
      `SES эвент алгаслаа: ${notificationType || '(тодорхойгүй)'}`,
    );
  }
}
