import { Module } from '@nestjs/common';
import { BlogPublicController, BlogAdminController } from './blog.controller';
import { BlogService } from './blog.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BlogPublicController, BlogAdminController],
  providers: [BlogService],
})
export class BlogModule {}
