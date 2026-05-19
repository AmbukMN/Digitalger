import { Module } from '@nestjs/common';
import { PagesPublicController, PagesAdminController } from './pages.controller';
import { PagesService } from './pages.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PagesPublicController, PagesAdminController],
  providers: [PagesService],
})
export class PagesModule {}
