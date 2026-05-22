import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminAiService } from './admin-ai.service';
import { ZIP_QUEUE } from '../downloads/zip.processor';

@Module({
  imports: [
    CategoriesModule,
    OrdersModule,
    UsersModule,
    ProductsModule,
    NotificationsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl') ?? 'redis://localhost:6379',
      }),
    }),
    BullModule.registerQueue({ name: ZIP_QUEUE }),
  ],
  controllers: [AdminController],
  providers: [AdminProductsService, AdminAiService],
})
export class AdminModule {}
