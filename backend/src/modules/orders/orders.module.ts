import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderCleanupService } from './order-cleanup.service';

// ScheduleModule.forRoot() нь app.module-д нэг удаа — энд хасав (order auto-cancel
// cron давхар ажиллаж купон давхар буцаахаас сэргийлэв).
@Module({
  imports: [StorageModule, NotificationsModule, NotificationCenterModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderCleanupService],
  exports: [OrdersService],
})
export class OrdersModule {}
