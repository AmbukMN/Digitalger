import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email.service';

/**
 * AWS SES → SNS үйл явдал боловсруулагч.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * Өмнө нь имэйл илгээснээс хойш ЮУ Ч мэдэгддэггүй байв — хүрсэн эсэх,
 * нээсэн эсэх, буцаагдсан эсэх. Админд «Илгээгдсэн 14» гэж харагдах ч
 * тэдгээрийн хэд нь хүнд хүрснийг мэдэх аргагүй. Мөн буцаагдсан хаяг
 * руу дахин дахин илгээж SES-ийн reputation унана.
 *
 * ⚠️ Урсгал: SES (Configuration Set) → SNS topic → HTTPS endpoint → энэ.
 *
 * ⚠️ SNS нь at-least-once — нэг үйл явдал ОЛОН УДАА ирж болно. Тиймээс
 *    бүх бичилт idempotent (openCount нь increment, харин openedAt нь
 *    зөвхөн ЭХНИЙ удаа бичигдэнэ).
 */

/** SNS дугтуйны хэлбэр */
interface SnsEnvelope {
  Type?: string;
  MessageId?: string;
  TopicArn?: string;
  Token?: string;
  SubscribeURL?: string;
  Message?: string;
}

/** SES үйл явдлын хэлбэр (SNS-ийн Message доторх JSON) */
interface SesEvent {
  eventType?: string;
  notificationType?: string;
  mail?: { messageId?: string; destination?: string[] };
  bounce?: { bounceType?: string; bounceSubType?: string; bouncedRecipients?: { emailAddress?: string; diagnosticCode?: string }[] };
  complaint?: { complainedRecipients?: { emailAddress?: string }[]; complaintFeedbackType?: string };
  delivery?: { timestamp?: string };
  open?: { timestamp?: string };
  click?: { timestamp?: string; link?: string };
}

@Injectable()
export class EmailEventsService {
  private readonly logger = new Logger('EmailEvents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * SNS-ээс ирсэн биеийг боловсруулна.
   *
   * ⚠️ ҮРГЭЛЖ 200 буцаана (controller талд) — алдаа буцаавал SNS дахин
   *    дахин илгээж, эцэст нь subscription-ыг унтраадаг.
   */
  async handle(body: SnsEnvelope | string): Promise<{ ok: true; action: string }> {
    const env: SnsEnvelope = typeof body === 'string' ? safeJson(body) : body;

    /**
     * ⚠️ SNS БАТАЛГААЖУУЛАЛТ — topic үүсгэхэд ЭХЛЭЭД энэ ирнэ.
     * `SubscribeURL`-ыг дуудахгүй бол subscription идэвхжихгүй, дараа нь
     * ямар ч үйл явдал ирэхгүй (чимээгүй бүтэлгүйтэл).
     */
    if (env?.Type === 'SubscriptionConfirmation' && env.SubscribeURL) {
      await this.confirmSubscription(env.SubscribeURL);
      return { ok: true, action: 'subscription-confirmed' };
    }

    if (env?.Type === 'UnsubscribeConfirmation') {
      this.logger.warn('SNS subscription цуцлагдав — имэйлийн хяналт зогсоно');
      return { ok: true, action: 'unsubscribed' };
    }

    /* Notification — доторх Message нь SES үйл явдлын JSON (мөр хэлбэрээр) */
    const ev: SesEvent = safeJson(env?.Message ?? '');
    const kind = (ev.eventType ?? ev.notificationType ?? '').toLowerCase();
    const messageId = ev.mail?.messageId;

    if (!kind) return { ok: true, action: 'ignored-no-type' };
    if (!messageId) {
      this.logger.warn(`SES үйл явдал messageId-гүй: ${kind}`);
      return { ok: true, action: 'ignored-no-id' };
    }

    switch (kind) {
      case 'delivery':
        await this.mark(messageId, { deliveredAt: new Date() });
        return { ok: true, action: 'delivery' };

      case 'open':
        await this.markOpen(messageId);
        return { ok: true, action: 'open' };

      case 'click':
        await this.markClick(messageId);
        return { ok: true, action: 'click' };

      case 'bounce':
        await this.handleBounce(ev);
        return { ok: true, action: 'bounce' };

      case 'complaint':
        await this.handleComplaint(ev);
        return { ok: true, action: 'complaint' };

      default:
        return { ok: true, action: `ignored-${kind}` };
    }
  }

  // ─── Тусгай боловсруулагчид ─────────────────────────────────────────────────

  /**
   * ⚠️ ЭХНИЙ нээлтийг ХАДГАЛНА, дараагийнхад зөвхөн тоолуур нэмнэ.
   * «Хэр хурдан нээв» гэдэг нь маркетингийн гол хэмжүүр — дарж бичвэл
   * тэр мэдээлэл алдагдана.
   */
  private async markOpen(messageId: string) {
    const row = await this.prisma.emailLog
      .findUnique({ where: { messageId }, select: { id: true, openedAt: true } })
      .catch(() => null);
    if (!row) return this.warnUnknown(messageId, 'open');

    await this.prisma.emailLog
      .update({
        where: { id: row.id },
        data: {
          openCount: { increment: 1 },
          ...(row.openedAt ? {} : { openedAt: new Date() }),
        },
      })
      .catch(() => null);
  }

  private async markClick(messageId: string) {
    const row = await this.prisma.emailLog
      .findUnique({ where: { messageId }, select: { id: true, clickedAt: true, openedAt: true } })
      .catch(() => null);
    if (!row) return this.warnUnknown(messageId, 'click');

    await this.prisma.emailLog
      .update({
        where: { id: row.id },
        data: {
          clickCount: { increment: 1 },
          ...(row.clickedAt ? {} : { clickedAt: new Date() }),
          /**
           * ⚠️ Дарсан бол НЭЭСЭН нь тодорхой. Зарим шуудангийн клиент
           * зураг блоклодог тул Open үйл явдал ирдэггүй — тэгэхэд
           * «дарсан атлаа нээгээгүй» гэсэн утгагүй тоо гарна.
           */
          ...(row.openedAt ? {} : { openedAt: new Date() }),
        },
      })
      .catch(() => null);
  }

  /**
   * ⚠️⚠️ BOUNCE — ЗӨВХӨН `Permanent` төрөлд suppression нэмнэ.
   *
   * `Transient` (шуудангийн хайрцаг дүүрсэн, түр саатал) дээр хаяг
   * хориглох нь БУРУУ — хэрэглэгч дараа нь имэйл авахаа болино.
   */
  private async handleBounce(ev: SesEvent) {
    const messageId = ev.mail?.messageId;
    const type = ev.bounce?.bounceType ?? 'Unknown';
    const subType = ev.bounce?.bounceSubType;

    if (messageId) {
      await this.mark(messageId, { bouncedAt: new Date(), bounceType: type });
    }

    if (type !== 'Permanent') {
      this.logger.warn(`Түр bounce (хориглохгүй): ${type}/${subType}`);
      return;
    }

    const recips = ev.bounce?.bouncedRecipients ?? [];
    for (const r of recips) {
      if (!r.emailAddress) continue;
      await this.email.addSuppression(r.emailAddress, 'bounce', subType, r.diagnosticCode);
      await this.markSubscriberBounced(r.emailAddress);
      this.logger.warn(`Хориглов (permanent bounce): ${r.emailAddress}`);
    }
  }

  /** Спам гэж мэдээлсэн — ЗААВАЛ хориглоно (SES reputation) */
  private async handleComplaint(ev: SesEvent) {
    const messageId = ev.mail?.messageId;
    if (messageId) {
      await this.mark(messageId, { bouncedAt: new Date(), bounceType: 'Complaint' });
    }

    const recips = ev.complaint?.complainedRecipients ?? [];
    for (const r of recips) {
      if (!r.emailAddress) continue;
      await this.email.addSuppression(
        r.emailAddress,
        'complaint',
        ev.complaint?.complaintFeedbackType,
      );
      await this.markSubscriberBounced(r.emailAddress);
      this.logger.warn(`Хориглов (спам гомдол): ${r.emailAddress}`);
    }
  }

  /**
   * Мэдээллийн товхимлын бүртгэлийг BOUNCED болгоно.
   * ⚠️ Өмнө нь `SubscriberStatus.BOUNCED`-ыг ХААНА Ч оноодоггүй байсан
   *    тул админ панелийн «Bounce» карт МӨНХ 0 байв.
   */
  private async markSubscriberBounced(email: string) {
    await this.prisma.subscriber
      .updateMany({
        where: { email: email.toLowerCase().trim() },
        data: { status: 'BOUNCED' },
      })
      .catch(() => null);
  }

  // ─── Туслах ─────────────────────────────────────────────────────────────────

  private async mark(messageId: string, data: Record<string, unknown>) {
    /* ⚠️ updateMany — олдоогүй үед алдаа ШИДЭХГҮЙ (SNS дахин илгээхээс сэргийлнэ) */
    const res = await this.prisma.emailLog
      .updateMany({ where: { messageId }, data })
      .catch(() => ({ count: 0 }));
    if (!res.count) this.warnUnknown(messageId, Object.keys(data)[0]);
  }

  /**
   * ⚠️ Танихгүй messageId — ЭНГИЙН зүйл: хяналт асаахаас ӨМНӨ илгээсэн
   * имэйлүүдэд messageId хадгалагдаагүй. Алдаа БИШ, зөвхөн тэмдэглэнэ.
   */
  private warnUnknown(messageId: string, kind: string) {
    this.logger.debug(`Танихгүй messageId (${kind}): ${messageId.slice(0, 20)}…`);
  }

  /**
   * SNS subscription баталгаажуулна.
   * ⚠️ URL нь ЗААВАЛ amazonaws.com домэйнтэй байх — эс бөгөөс халдагч
   *    хуурамч SNS илгээж, манай серверээр дурын хаяг руу хүсэлт
   *    явуулах (SSRF) боломжтой.
   */
  private async confirmSubscription(url: string) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      this.logger.error('SNS SubscribeURL буруу форматтай');
      return;
    }
    if (!/(^|\.)amazonaws\.com$/i.test(host)) {
      this.logger.error(`SNS SubscribeURL сэжигтэй домэйн: ${host}`);
      return;
    }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      this.logger.log(`SNS subscription баталгаажлаа (HTTP ${r.status})`);
    } catch (e) {
      this.logger.error(`SNS баталгаажуулалт амжилтгүй: ${String(e)}`);
    }
  }
}

/** JSON задлах — алдаа шидэхгүй (SNS-ийн бие гэмтсэн байж болно) */
function safeJson<T = Record<string, unknown>>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return {} as T;
  }
}
