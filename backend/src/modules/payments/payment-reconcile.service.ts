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
      await this.payments.reconcilePendingPayments(72);
    } catch (err) {
      this.logger.error('Payment reconcile cron алдаа', err);
    }
  }
}
