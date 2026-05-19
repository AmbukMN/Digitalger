import { Module } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import {
  TestimonialsAdminController,
  TestimonialsPublicController,
} from './testimonials.controller';

@Module({
  controllers: [TestimonialsPublicController, TestimonialsAdminController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
