import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UploadsController } from './uploads.controller';
import { VIDEO_QUEUE } from '../videos/video-queue.types';
import { VideoRecoveryService } from '../videos/video-recovery.service';

@Module({
  imports: [BullModule.registerQueue({ name: VIDEO_QUEUE })],
  providers: [VideoRecoveryService],
  controllers: [UploadsController],
})
export class UploadsModule {}
