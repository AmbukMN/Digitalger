import { Module } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { FaqsAdminController, FaqsPublicController } from './faqs.controller';

@Module({
  controllers: [FaqsPublicController, FaqsAdminController],
  providers: [FaqsService],
  exports: [FaqsService],
})
export class FaqsModule {}
