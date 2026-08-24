import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BonumService } from './bonum.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmailService } from '../email/email.service';

/**
 * АВТОМАТ СУНГАЛТ — багц дуусахад хадгалсан картаас автоматаар төлнө.
 *
 * ⚠️⚠️ ХАМГИЙН ЭМЗЭГ ХЭСЭГ: энэ нь хэрэглэгчийн МӨНГИЙГ өөрийнх нь
 * оролцоогүйгээр татдаг. Тиймээс дараах баталгаанууд ЗААВАЛ:
 *
 *  1. ЗӨВХӨН `autoRenew=true` БА карттай захиалга (хэрэглэгч чеклэсэн)
 *  2. Өдөрт НЭГ Л удаа оролдоно (`lastRenewTriedAt`) — cron давтагдаж
 *     хэд дахин татахаас сэргийлнэ
 *  3. Аль хэдийн сунгагдсан бол алгасна (идемпотент)
 *  4. 3 удаа дараалан амжилтгүй бол сунгалтыг УНТРААНА — хүчингүй
 *     картыг өдөр бүр татвал банк chargeback тавина
 *  5. Bonum «QUEUED» гэвэл амжилтгүй гэж үзэхгүй (хариу дараа ирнэ)
 */
@Injectable()
export class AutoRenewService {
  private readonly logger = new Logger(AutoRenewService.name);
  /** ⚠️ Өмнөх ажиллагаа дуусаагүй бол давхар эхлэхгүй */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bonum: BonumService,
    private readonly subs: SubscriptionsService,
    private readonly email: EmailService,
  ) {}

  /**
   * Өдөрт нэг удаа (UB 09:00 орчим). Дуусахаас 1 өдрийн өмнөөс эхэлж
   * оролдоно — амжилтгүй болбол дахин оролдох зав үлдэнэ.
   */
  @Cron('0 1 * * *')
  async runDaily() {
    if (!this.bonum.isConfigured()) return;
    if (this.running) {
      this.logger.warn('Автомат сунгалт аль хэдийн ажиллаж байна — алгаслаа');
      return;
    }
    this.running = true;
    try {
      await this.renewDueSubscriptions();
    } catch (e) {
      this.logger.error(`Автомат сунгалт унасан: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }

  private async renewDueSubscriptions() {
    const now = new Date();
    /* Дуусахад 1 хоногоос бага үлдсэн (эсвэл аль хэдийн дууссан) */
    const soon = new Date(now.getTime() + 86400_000);
    /* ⚠️ Хэт хуучин (7 хоногоос дээш дууссан) бол сунгахгүй — хэрэглэгч
       аль хэдийн орхисон байж болзошгүй, гэнэт мөнгө татвал гомдол болно */
    const floor = new Date(now.getTime() - 7 * 86400_000);
    /* Өнөөдөр аль хэдийн оролдсоныг алгасна */
    const retryAfter = new Date(now.getTime() - 20 * 3600_000);

    const due = await this.prisma.subscription.findMany({
      where: {
        autoRenew: true,
        cardId: { not: null },
        expiresAt: { lte: soon, gte: floor },
        renewFailCount: { lt: 3 },
        OR: [{ lastRenewTriedAt: null }, { lastRenewTriedAt: { lt: retryAfter } }],
      },
      select: {
        id: true,
        userId: true,
        planId: true,
        expiresAt: true,
        cardId: true,
        renewFailCount: true,
        card: { select: { id: true, token: true, mask: true } },
        plan: { select: { name: true, price: true, durationDays: true, isActive: true } },
        user: { select: { email: true, name: true } },
      },
      take: 200,
    });

    if (!due.length) return;
    this.logger.log(`Автомат сунгалт: ${due.length} захиалга шалгаж байна`);

    for (const s of due) {
      /* ⚠️ Cron дунд карт устгагдсан / багц идэвхгүй болсон байж болно */
      if (!s.card?.token || !s.plan?.isActive) {
        await this.disable(s.id, 'карт эсвэл багц боломжгүй');
        continue;
      }
      /**
       * ⚠️ ИДЕМПОТЕНТ: энэ хооронд хэрэглэгч ӨӨРӨӨ сунгасан байж
       * болно. Ижил багцын идэвхтэй эрх ирээдүйд сунасан бол дахин
       * татахгүй (давхар төлбөрөөс хамгаална).
       */
      const alreadyExtended = await this.prisma.subscription.findFirst({
        where: {
          userId: s.userId,
          planId: s.planId,
          expiresAt: { gt: soon },
          id: { not: s.id },
        },
        select: { id: true },
      });
      if (alreadyExtended) {
        this.logger.log(`Сунгалт шаардлагагүй (өөрөө сунгасан): sub=${s.id}`);
        await this.prisma.subscription.update({
          where: { id: s.id },
          data: { autoRenew: false },
        });
        continue;
      }

      await this.chargeOne(s);
    }
  }

  /** Нэг захиалгыг картаас татаж сунгана */
  private async chargeOne(s: {
    id: string;
    userId: string;
    planId: string;
    renewFailCount: number;
    cardId: string | null;
    card: { id: string; token: string; mask: string } | null;
    plan: { name: string; price: number; durationDays: number } | null;
    user: { email: string | null; name: string | null } | null;
  }) {
    const amount = s.plan!.price;
    const transactionId = randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();

    /**
     * ⚠️⚠️ ОРОЛДЛОГЫГ ЭХЛЭЭД ТЭМДЭГЛЭНЭ. Хэрэв төлбөр явсан ч сервер
     * унавал `lastRenewTriedAt` тэмдэглэгдсэн байх тул маргааш дахин
     * татахгүй (ДАВХАР ТӨЛБӨРӨӨС хамгаална — мөнгө буцаах нь хамгийн
     * муу хэрэглэгчийн туршлага).
     */
    await this.prisma.subscription.update({
      where: { id: s.id },
      data: { lastRenewTriedAt: new Date() },
    });

    /* Төлбөрийн мөр урьдчилж үүсгэнэ — түүх, админ хяналтад харагдана */
    const payment = await this.prisma.payment.create({
      data: {
        userId: s.userId,
        planId: s.planId,
        amount,
        status: PaymentStatus.PENDING,
        bonumInvoiceId: `AUTO:${transactionId}`,
      },
    });

    const result = await this.bonum.purchaseWithToken(s.card!.token, amount, transactionId);

    if (result === 'SUCCESS') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });
      const sub = await this.subs.grant(s.userId, s.planId, s.plan!.durationDays, payment.id);
      /* ⚠️ Шинэ захиалганд сунгалтыг ҮРГЭЛЖЛҮҮЛНЭ (карт хэвээр) */
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { autoRenew: true, cardId: s.cardId },
      });
      /* Хуучин мөрийн сунгалтыг унтраана — давхар татахгүй */
      await this.prisma.subscription.update({
        where: { id: s.id },
        data: { autoRenew: false, renewFailCount: 0 },
      });
      this.logger.log(`Автомат сунгалт амжилттай: user=${s.userId} ${s.plan!.name}`);
      await this.notify(s.user?.email, 'renewed', s.plan!.name, amount, s.card!.mask);
      return;
    }

    if (result === 'QUEUED') {
      /**
       * ⚠️ Дараалалд орсон — үр дүн webhook-оор ирнэ. Амжилтгүй гэж
       * ҮЗЭХГҮЙ (failCount нэмэхгүй). Payment нь PENDING хэвээр үлдэж,
       * reconcile cron барина.
       */
      this.logger.log(`Автомат сунгалт дараалалд: sub=${s.id}`);
      return;
    }

    /* FAILED */
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    const fails = s.renewFailCount + 1;
    await this.prisma.subscription.update({
      where: { id: s.id },
      data: { renewFailCount: fails },
    });
    this.logger.warn(`Автомат сунгалт амжилтгүй (${fails}/3): sub=${s.id}`);

    if (fails >= 3) {
      await this.disable(s.id, '3 удаа амжилтгүй');
      await this.notify(s.user?.email, 'failed', s.plan!.name, amount, s.card!.mask);
    }
  }

  private async disable(subId: string, reason: string) {
    await this.prisma.subscription.update({
      where: { id: subId },
      data: { autoRenew: false, autoRenewCancelledAt: new Date() },
    });
    this.logger.warn(`Автомат сунгалт унтраалаа (${reason}): sub=${subId}`);
  }

  /**
   * ⚠️ Имэйл АМЖИЛТГҮЙ болох нь сунгалтыг унагаах ЁСГҮЙ — try/catch.
   * ⚠️ Мөнгө татсан тухай хэрэглэгчид ЗААВАЛ мэдэгдэнэ (санамсаргүй
   *    төлбөр гэж бодохоос сэргийлнэ, хууль ёсны шаардлага ч мөн).
   */
  private async notify(
    email: string | null | undefined,
    kind: 'renewed' | 'failed',
    planName: string,
    amount: number,
    mask: string,
  ) {
    if (!email) return;
    try {
      const fmt = new Intl.NumberFormat('mn-MN').format(amount);
      if (kind === 'renewed') {
        await this.email.send({
          to: email,
          subject: `${planName} багц автоматаар сунгагдлаа`,
          template: 'subscription',
          html: [
            `<p>Таны <b>${planName}</b> багц автоматаар сунгагдлаа.</p>`,
            `<p>Дүн: <b>${fmt}₮</b><br/>Карт: ${mask}</p>`,
            `<p>Автомат сунгалтыг профайлаасаа хэдийд ч болиулж болно.</p>`,
          ].join(''),
        });
      } else {
        await this.email.send({
          to: email,
          subject: `${planName} багцын автомат сунгалт амжилтгүй`,
          template: 'subscription',
          html: [
            `<p>Таны <b>${planName}</b> багцыг сунгах гэж 3 удаа оролдсон боловч`,
            ` картаас (${mask}) төлбөр татагдсангүй.</p>`,
            `<p>Автомат сунгалт унтарлаа. Үргэлжлүүлэн үзэхийн тулд`,
            ` сайт дээрээс багцаа шинэчилнэ үү.</p>`,
          ].join(''),
        });
      }
    } catch (e) {
      this.logger.error(`Сунгалтын имэйл илгээгдсэнгүй: ${String(e)}`);
    }
  }
}
