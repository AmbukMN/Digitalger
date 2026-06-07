import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailEventsController } from './email-events.controller';

// PrismaModule global тул import шаардлагагүй. EmailService-ийг
// NotificationsModule-аас авна.
@Module({
  imports: [NotificationsModule],
  controllers: [EmailEventsController],
})
export class EmailEventsModule {}
