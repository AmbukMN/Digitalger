import { Module } from '@nestjs/common';
import { HelpVideosService } from './help-videos.service';
import {
  HelpVideosAdminController,
  HelpVideosPublicController,
} from './help-videos.controller';

@Module({
  controllers: [HelpVideosPublicController, HelpVideosAdminController],
  providers: [HelpVideosService],
  exports: [HelpVideosService],
})
export class HelpVideosModule {}
