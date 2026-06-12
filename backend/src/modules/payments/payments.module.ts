import { Module } from '@nestjs/common';
import { N8nModule } from '../n8n/n8n.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { NotificationCenterModule } from '../notification-center/notification-center.module';

// ScheduleModule.forRoot() нь app.module-д нэг удаа дуудагдсан — энд дахин
// дуудвал cron давхар бүртгэгдэнэ. Provider дотор @Cron ажиллахад нэмэлт
// import шаардлагагүй (forRoot global).
@Module({
  imports: [N8nModule, NotificationCenterModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentReconcileService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
