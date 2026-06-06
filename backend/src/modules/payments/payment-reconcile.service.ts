import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

// PENDING захиалгуудыг QPay-аас тогтмол шалгаж, төлөгдсөнийг автомат confirm
// хийнэ. Webhook найдваргүй (QPay заримдаа илгээдэггүй) тул энэ нь найдвартай
// fallback — хэрэглэгч төлсөн ч webhook ирээгүй захиалга 5 минут дотор баригдаж
// бараагаа авна.
@Injectable()
export class PaymentReconcileService {
  private readonly logger = new Logger(PaymentReconcileService.name);
  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile() {
    try {
      // Зөвхөн сүүлийн 2 цагийн PENDING — хэрэглэгч 5-30 мин дотор төлдөг тул
      // 2ц хангалттай. Хуучин (хэзээ ч төлөгдөхгүй) захиалгыг дахин дахин
      // шалгахгүй. PENDING байхгүй бол QPay-руу хүсэлт явуулахгүй (хоосон ажиллана).
      await this.payments.reconcilePendingPayments(2);
    } catch (err) {
      this.logger.error('Payment reconcile cron алдаа', err);
    }
  }
}
