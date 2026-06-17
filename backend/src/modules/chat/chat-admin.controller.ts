import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { EmailService } from '../notifications/email.service';
import { PrismaService } from '../../prisma/prisma.service';

// Admin chat (human-handoff) — RolesGuard @Roles(ADMIN). EDITOR/ADMIN/SUPERADMIN.
@Controller('admin/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.EDITOR, Role.ADMIN, Role.SUPERADMIN)
export class ChatAdminController {
  constructor(
    private readonly chat: ChatService,
    private readonly notify: NotificationCenterService,
    private readonly email: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  // Бүх чат жагсаалт (?page, ?pageSize, ?onlyUnread=1)
  @Get('conversations')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('onlyUnread') onlyUnread?: string,
  ) {
    return this.chat.listConversations({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      onlyUnread: onlyUnread === '1' || onlyUnread === 'true',
    });
  }

  // Sidebar badge — уншаагүй чатын тоо
  @Get('unread-count')
  async unreadCount() {
    const r = await this.chat.listConversations({ page: 1, pageSize: 1, onlyUnread: true });
    return { unreadTotal: r.unreadTotal };
  }

  // Нэг чат дэлгэрэнгүй (нээхэд adminUnread=false)
  @Get('conversations/:id')
  detail(@Param('id') id: string) {
    return this.chat.getConversation(id);
  }

  // Admin гар хариу → хэрэглэгчид notification (in-app) + email (нэвтэрсэн бол)
  @Post('conversations/:id/reply')
  async reply(@Param('id') id: string, @Body() body: { text?: string }) {
    const res = await this.chat.adminReply(id, body?.text ?? '');
    if (!res) return { ok: false };

    // Нэвтэрсэн хэрэглэгчтэй бол in-app notification + email (fire-and-forget).
    if (res.userId) {
      this.notify
        .create(res.userId, {
          title: 'Чатад хариу ирлээ',
          body: res.message.text.slice(0, 120),
          type: 'info',
          link: '/?chat=open',
        })
        .catch(() => null);
      // Email — нэвтэрсэн хэрэглэгчийн хаяг руу (зочинд email байхгүй).
      this.prisma.user
        .findUnique({ where: { id: res.userId }, select: { email: true, name: true, isGuest: true } })
        .then((u) => {
          if (u?.email && !u.isGuest) {
            const html = `<p>Сайн байна уу${u.name ? ', ' + u.name : ''}!</p>
<p>DigitalGer чатад манай багаас хариу ирлээ:</p>
<blockquote style="border-left:3px solid #022179;padding-left:12px;color:#333;">${res.message.text}</blockquote>
<p><a href="https://digitalger.mn/?chat=open" style="display:inline-block;background:#022179;color:#fff;text-decoration:none;font-weight:700;padding:10px 24px;border-radius:8px;">Чат нээх</a></p>`;
            this.email.sendRaw(u.email, 'DigitalGer — чатад хариу ирлээ', html, undefined, 'chat-reply').catch(() => null);
          }
        })
        .catch(() => null);
    }
    return { ok: true, message: res.message };
  }

  // "Чат авах / AI-д буцаах" toggle (handedOff)
  @Post('conversations/:id/handoff')
  handoff(@Param('id') id: string, @Body() body: { handedOff?: boolean }) {
    return this.chat.setHandoff(id, !!body?.handedOff);
  }
}
