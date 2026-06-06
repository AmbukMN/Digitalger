import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { TransferCleanupService } from './transfer-cleanup.service';

// ScheduleModule.forRoot() нь app.module-д нэг удаа — энд хасав (cron давхардлаас сэргийлэв).
@Module({
  controllers: [TransferController],
  providers: [TransferService, TransferCleanupService],
})
export class TransferModule {}
