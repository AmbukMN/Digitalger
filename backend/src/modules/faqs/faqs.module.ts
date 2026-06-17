import { Module } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import {
  FaqsAdminController,
  FaqsPublicController,
  HelpFaqsPublicController,
} from './faqs.controller';

@Module({
  controllers: [FaqsPublicController, HelpFaqsPublicController, FaqsAdminController],
  providers: [FaqsService],
  exports: [FaqsService],
})
export class FaqsModule {}
