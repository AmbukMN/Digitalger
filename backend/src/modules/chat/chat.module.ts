import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatAdminController } from './chat-admin.controller';
import { ChatService } from './chat.service';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscribersModule } from '../subscribers/subscribers.module';

@Module({
  imports: [NotificationCenterModule, NotificationsModule, SubscribersModule],
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
