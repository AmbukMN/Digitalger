import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';

@Module({
  imports: [NotificationsModule, NotificationCenterModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
