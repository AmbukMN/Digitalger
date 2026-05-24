import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StorageModule } from '../../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderCleanupService } from './order-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot(), StorageModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderCleanupService],
  exports: [OrdersService],
})
export class OrdersModule {}
