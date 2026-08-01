import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ⚠️ QPay нэхэмжлэл ~15 мин хүчинтэй. Гэхдээ хэрэглэгч дараа нь банкны
 * аппаараа төлж болзошгүй тул шууд цуцлахгүй — 24 цаг хүлээнэ.
 */
const PENDING_EXPIRE_HOURS = 24;

@Injectable()
export class PaymentCleanupService {
  private readonly logger = new Logger(PaymentCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

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
