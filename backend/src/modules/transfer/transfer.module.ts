import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { TransferCleanupService } from './transfer-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [TransferController],
  providers: [TransferService, TransferCleanupService],
})
export class TransferModule {}
