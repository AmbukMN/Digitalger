import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@SkipThrottle()
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly config: ConfigService,
  ) {}

  /**
   * n8n чатбот мессеж хадгалах (web/FB/IG). n8n workflow мессеж бүрд дуудна.
   * ⚠️ ХАМГААЛАЛТ:
   *   - N8N_WEBHOOK_SECRET тохируулсан бол x-webhook-secret header заавал таарах
   *     (n8n-ийн post() ижил header илгээдэг). Тохируулаагүй бол (dev) нээлттэй.
   *   - Throttle: нэг IP-ээс 240/мин (n8n олон дуудна ч бот/спам DoS-оос хязгаарлана).
   * Үргэлж { ok: true } буцаана — n8n workflow алдаа цацахгүй (best-effort logging).
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Post('save')
  async save(
    @Body()
    body: {
      channel?: string;
      sessionId?: string;
      role?: string;
      text?: string;
      userName?: string;
      userId?: string;
    },
    @Headers('x-webhook-secret') secret?: string,
  ) {
    const expected = this.config.get<string>('n8n.webhookSecret');
    // Secret тохируулсан бол заавал таарах ёстой (n8n-ээс л дуудагдана).
    if (expected && secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return this.chat.saveMessage({
      channel: body.channel ?? 'web',
      sessionId: body.sessionId ?? '',
      role: body.role ?? 'user',
      text: body.text ?? '',
      userName: body.userName,
      userId: body.userId,
    });
  }

  /**
   * Backfill — нэвтэрсэн хэрэглэгч өөрийн web chat session-ийг өөртөө холбоно.
   * Frontend нэвтрэх дараа (эсвэл чат нээх үед) sessionId-аар дуудна.
   * userId-ийг token-оос авна (body-оос биш) — өөр хүний session булаахаас хамгаалж.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('link-session')
  @UseGuards(JwtAuthGuard)
  async linkSession(
    @Body() body: { sessionId?: string },
    @CurrentUser() me: JwtPayload,
  ) {
    return this.chat.linkSession(body?.sessionId ?? '', me.sub);
  }
}
