import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

/** 5 минут тутам PENDING төлбөрүүдийг QPay-аас шалгана (webhook fallback) */
@Injectable()
export class PaymentsReconcileService {
  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  reconcile() {
    return this.payments.reconcilePending(2);
  }
}
