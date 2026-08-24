import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentsService } from './payments.service';
import { PaymentCleanupService } from './payment-cleanup.service';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PaymentsReconcileService } from './payments-reconcile.service';
import { BonumService } from './bonum.service';
import { AutoRenewService } from './auto-renew.service';
import { CouponsModule } from '../coupons/coupons.module';
import { WalletModule } from '../wallet/wallet.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { RentalsModule } from '../rentals/rentals.module';

@Module({
  /**
   * ⚠️ `RentalsModule` — QPay-ээр ширхэгээр түрээслэх урсгалд хэрэгтэй
   * (`completePayment` → `rentals.grantFromPayment`).
   * ⚠️ Дугуй хамаарал ҮҮСГЭХГҮЙ: `RentalsModule` нь `PaymentsModule`-ыг
   * импортолдоггүй (зөвхөн Wallet + Titles). Тэр талд төлбөр дуудвал
   * `forwardRef` шаардлагатай болно — БҮҮ нэм, оронд нь энэ чиглэлээр л
   * дуудна.
   */
  /* ⚠️ EmailModule — дуусаагүй төлбөрийн сануулга илгээхэд шаардлагатай.
     Дутуу бол DI ажиллах үед унана (typecheck барихгүй). */
  /* ⚠️ AnalyticsModule — Meta Conversions API (сервер талаас Purchase) */
  imports: [
    CouponsModule,
    WalletModule,
    RentalsModule,
    PromotionsModule,
    EmailModule,
    AnalyticsModule,
  ],
  controllers: [PaymentsController, PaymentsAdminController],
    /* ⚠️ AutoRenewService — өдөр тутмын cron. Багц дуусахад хадгалсан
     картаас автоматаар татдаг тул WORKER-т ч ажиллана (rebuild хэрэгтэй). */
  providers: [
    PaymentsService,
    BonumService,
    AutoRenewService,
    PaymentsReconcileService,
    PaymentCleanupService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
