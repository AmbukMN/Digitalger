import { Module } from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  SubscribersPublicController,
  AdminSubscribersController,
} from './subscribers.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [SubscribersPublicController, AdminSubscribersController],
  providers: [SubscribersService],
  exports: [SubscribersService],
})
export class SubscribersModule {}
