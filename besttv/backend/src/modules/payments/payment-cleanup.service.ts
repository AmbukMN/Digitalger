import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * ⚠️ QPay нэхэмжлэл ~15 мин хүчинтэй. Гэхдээ хэрэглэгч дараа нь банкны
 * аппаараа төлж болзошгүй тул шууд цуцлахгүй — 24 цаг хүлээнэ.
 */
const PENDING_EXPIRE_HOURS = 24;

@Injectable()
export class PaymentCleanupService {
  private readonly logger = new Logger(PaymentCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * WARN QPay QR made but never paid - nudge once, 2h later.
   *
   * Measured on production: 10 of 34 attempts expired unpaid (29%).
   * That is the single largest revenue leak in the funnel.
   *
   * Why 2-4 hours: under 2h the person may still be finishing in their
   * bank app, and a reminder would be noise. Past 4h the intent is
   * usually gone. The window also guarantees the hourly cron sees each
   * payment at least once and at most twice - `EmailLog` dedupes the
   * overlap, so nobody is mailed twice.
   *
   * WARN Runs BEFORE `expireStalePayments` (24h) so the payment is
   * still PENDING when we look at it.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async remindAbandonedPayments() {
    const now = Date.now();
    const from = new Date(now - 4 * 3600_000);
    const to = new Date(now - 2 * 3600_000);

    const rows = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { gte: from, lt: to },
        /* Wallet top-ups and rentals are not a plan purchase */
        isWalletTopup: false,
        planId: { not: null },
        /* WARN Bank transfers are handled by a human - never nudge those */
        bankReference: null,
        user: {
          isActive: true,
          isGuest: false,
          marketingOptOut: false,
          emailVerified: true,
        },
      },
      select: {
        id: true,
        amount: true,
        user: { select: { id: true, email: true, name: true } },
        plan: { select: { name: true } },
      },
      take: 100,
    });

    if (!rows.length) return;

    let sent = 0;
    for (const p of rows) {
      /**
       * WARN Skip if this user already got the nudge - the 2-4h window
       * can catch the same payment on two consecutive runs.
       */
      const already = await this.prisma.emailLog.findFirst({
        where: {
          to: p.user.email,
          template: 'payment-abandoned',
          createdAt: { gte: new Date(now - 24 * 3600_000) },
        },
        select: { id: true },
      });
      if (already) continue;

      /* WARN One bad address must not stop the rest of the batch */
      const ok = await this.email
        .sendPaymentAbandoned({
          to: p.user.email,
          name: p.user.name,
          planName: p.plan?.name ?? 'Багц',
          amount: p.amount,
          userId: p.user.id,
        })
        .catch((e) => {
          this.logger.warn(`Сануулга илгээж чадсангүй (${p.id}): ${String(e).slice(0, 120)}`);
          return false;
        });
      if (ok) sent++;
    }

    if (sent) this.logger.log(`${sent} дуусаагүй төлбөрт сануулга илгээв`);
  }

  /**
   * Хугацаа хэтэрсэн PENDING төлбөрийг автомат EXPIRED болгоно.
   *
   * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: төлөгдөөгүй нэхэмжлэл мөнхөд "Хүлээгдэж буй"
   * төлөвтэй үлдэж, админы жагсаалт бохирдож, статистик гуйвдаг байсан.
   *
   * ⚠️ CANCELLED биш EXPIRED — "хэрэглэгч/админ цуцалсан" ба "хугацаа
   * дууссан" хоёрыг ялгаж хөтөлнө.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireStalePayments() {
    const cutoff = new Date(Date.now() - PENDING_EXPIRE_HOURS * 3600_000);

    const result = await this.prisma.payment.updateMany({
      where: { status: PaymentStatus.PENDING, createdAt: { lt: cutoff } },
      data: { status: PaymentStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(
        `${result.count} хугацаа хэтэрсэн төлбөрийг EXPIRED болголоо (${PENDING_EXPIRE_HOURS}ц)`,
      );
    }
  }

  /**
   * Хугацаа нь дууссан OTP кодуудыг устгана (DB хуримтлагдахаас сэргийлнэ).
   * ⚠️ Ашигласан код ч 24 цагийн дараа устана — audit хэрэггүй.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredOtps() {
    const result = await this.prisma.emailOtp.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} хуучирсан OTP устгалаа`);
    }
  }
}
