import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { N8nModule } from '../n8n/n8n.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentReconcileService } from './payment-reconcile.service';

@Module({
  imports: [N8nModule, ScheduleModule.forRoot()],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentReconcileService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
