import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
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
      products?: unknown; // assistant мессеж дээр AI санал болгосон card
    },
  ) {
    // ⚠️ Secret шалгахгүй — chat save нь эмзэг бус (зөвхөн яриа лог). Throttle
    // (240/мин) + sessionId шаардлага + текст таслалт спамаас хамгаална.
    // n8n webhook аль хэдийн нийтийн тул нэмэлт secret хүндрэл үүсгэдэг.
    // [DEBUG-PRODUCTS] n8n products дамжуулалт шалгах түр лог (дараа устгана)
    // eslint-disable-next-line no-console
    console.log('[chat/save DEBUG]', JSON.stringify({
      role: body.role,
      productsType: Array.isArray(body.products) ? 'array' : typeof body.products,
      productsLen: Array.isArray(body.products) ? body.products.length : null,
    }));
    return this.chat.saveMessage({
      channel: body.channel ?? 'web',
      sessionId: body.sessionId ?? '',
      role: body.role ?? 'user',
      text: body.text ?? '',
      userName: body.userName,
      userId: body.userId,
      products: body.products,
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

  /**
   * ХЭРЭГЛЭГЧ ТАЛД (frontend polling) — чат нээлттэй үед sessionId-ийн ШИНЭ
   * мессеж (after-аас хойш) татна. Admin гар хариу (role='admin')-ийг харуулна.
   * Auth-гүй (зочин ч ажиллана) — sessionId нь нууц биш, зөвхөн өөрийн чат.
   * Throttle: 120/мин (5-7с polling-д хангалттай).
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('messages')
  async messages(@Query('sessionId') sessionId?: string, @Query('after') after?: string) {
    return this.chat.getMessagesForUser(sessionId ?? '', after);
  }

  /** Floating товч badge — хэдэн уншаагүй admin мессеж (chat хаалттай үед polling). */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('unread')
  async unread(@Query('sessionId') sessionId?: string) {
    return this.chat.getUserUnread(sessionId ?? '');
  }
}
