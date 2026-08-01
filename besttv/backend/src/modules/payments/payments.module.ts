import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentsService } from './payments.service';
import { PaymentCleanupService } from './payment-cleanup.service';
import { PaymentsReconcileService } from './payments-reconcile.service';
import { CouponsModule } from '../coupons/coupons.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [CouponsModule, WalletModule],
  controllers: [PaymentsController, PaymentsAdminController],
  providers: [PaymentsService, PaymentsReconcileService, PaymentCleanupService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
