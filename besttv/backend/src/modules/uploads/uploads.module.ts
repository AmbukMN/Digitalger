import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UploadsController } from './uploads.controller';
import { VIDEO_QUEUE } from '../videos/video-queue.types';
import { VideoRecoveryService } from '../videos/video-recovery.service';
import { VideoDownloadService } from '../videos/video-download.service';
import {
  VideoDownloadController,
  VideoDownloadPublicController,
} from '../videos/video-download.controller';

@Module({
  imports: [BullModule.registerQueue({ name: VIDEO_QUEUE })],
  providers: [VideoRecoveryService, VideoDownloadService],
  controllers: [UploadsController, VideoDownloadController, VideoDownloadPublicController],
})
export class UploadsModule {}
