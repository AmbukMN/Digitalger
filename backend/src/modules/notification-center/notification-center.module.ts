import { Module } from '@nestjs/common';
import { NotificationCenterController } from './notification-center.controller';
import { NotificationCenterService } from './notification-center.service';

// In-app мэдэгдлийн модуль (navbar 🔔). PrismaModule global тул import шаардлагагүй.
// Service-ийг export — orders/payments/courses нь event дээр notification үүсгэхэд
// inject хийнэ.
@Module({
  controllers: [NotificationCenterController],
  providers: [NotificationCenterService],
  exports: [NotificationCenterService],
})
export class NotificationCenterModule {}
