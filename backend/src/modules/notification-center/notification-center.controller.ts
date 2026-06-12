import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationCenterService } from './notification-center.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationCenterController {
  constructor(private readonly notifications: NotificationCenterService) {}

  // GET /notifications — сүүлийн N мэдэгдэл
  @Get()
  list(@CurrentUser('sub') userId: string, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 20;
    return this.notifications.listForUser(userId, Number.isFinite(n) ? n : 20);
  }

  // GET /notifications/unread-count — { count }
  @Get('unread-count')
  async unreadCount(@CurrentUser('sub') userId: string) {
    const count = await this.notifications.unreadCount(userId);
    return { count };
  }

  // POST /notifications/:id/read — нэг уншсан болгох
  @Post(':id/read')
  markRead(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  // POST /notifications/read-all — бүгдийг уншсан болгох
  @Post('read-all')
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
