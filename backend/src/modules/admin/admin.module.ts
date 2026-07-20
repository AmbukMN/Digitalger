import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { N8nModule } from '../n8n/n8n.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { CoursesModule } from '../courses/courses.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { DownloadsModule } from '../downloads/downloads.module';
import { AdminController } from './admin.controller';
import { StaffController } from './staff.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminAiService } from './admin-ai.service';
import { ZIP_QUEUE } from '../downloads/zip.processor';
import { VIDEO_QUEUE } from '../videos/video-queue.types';

@Module({
  imports: [
    CategoriesModule,
    OrdersModule,
    UsersModule,
    ProductsModule,
    NotificationsModule,
    N8nModule,
    ReviewsModule,
    CoursesModule,
    NotificationCenterModule,
    DownloadsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl') ?? 'redis://localhost:6379',
      }),
    }),
    BullModule.registerQueue({ name: ZIP_QUEUE }),
    // VIDEO_QUEUE producer — admin хичээлийн видео R2 HLS-руу job нэмнэ (consumer=worker).
    BullModule.registerQueue({ name: VIDEO_QUEUE }),
  ],
  controllers: [AdminController, StaffController],
  providers: [AdminProductsService, AdminAiService],
})
export class AdminModule {}
