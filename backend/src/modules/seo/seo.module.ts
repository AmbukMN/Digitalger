import { Module } from '@nestjs/common';
import { SeoPublicController, SeoAdminController } from './seo.controller';
import { SeoService } from './seo.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SeoPublicController, SeoAdminController],
  providers: [SeoService],
})
export class SeoModule {}
