import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HelpVideosService } from './help-videos.service';
import {
  HelpVideosAdminController,
  HelpVideosPublicController,
} from './help-videos.controller';
import { VIDEO_QUEUE } from '../videos/video-queue.types';

@Module({
  // VIDEO_QUEUE producer — admin upload HLS-руу job нэмнэ (consumer нь worker).
  imports: [BullModule.registerQueue({ name: VIDEO_QUEUE })],
  controllers: [HelpVideosPublicController, HelpVideosAdminController],
  providers: [HelpVideosService],
  exports: [HelpVideosService],
})
export class HelpVideosModule {}
