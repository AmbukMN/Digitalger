import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ChatService, type ChatTitleCard } from './chat.service';

/**
 * Нийтийн чат endpoint-ууд.
 *
 * ⚠️ Secret шалгахгүй — чат лог нь эмзэг бус. Throttle + sessionId шаардлага +
 * текст таслалт спамаас хамгаална. n8n webhook аль хэдийн нийтийн тул нэмэлт
 * secret нь хүндрэл л үүсгэнэ (DigitalGer дээр ижил шийдэл).
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Handoff үед widget шууд энд бичнэ (n8n дамжуулахгүй) */
  /**
   * ⚠️⚠️ ХОЁР ЦООРХОЙ ХААСАН:
   *
   * 1. `role: 'admin'` — халдлагч хохирогчийн `sessionId`-д "админ"
   *    нэрийн өмнөөс мессеж бичиж phishing хийж болно ("картын
   *    мэдээллээ энд илгээнэ үү"). Одоо `user`-ээс өөр role-ыг
   *    ХҮЛЭЭН АВАХГҮЙ — админы хариу нь `adminReply`-аар л ирнэ,
   *    AI-ийнх нь `/chat/ingest`-ээр.
   *
   * 2. `userId`-г BODY-ООС авдаг байсан — дурын яриаг өөр хэрэглэгчид
   *    зүүх боломжтой байв. Одоо ЗӨВХӨН token-оос (`linkSession`-той
   *    ижил зарчим).
   */
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Post('save')
  save(
    @Body()
    body: {
      channel?: string;
      sessionId?: string;
      text?: string;
      userName?: string;
      titles?: ChatTitleCard[];
    },
    @CurrentUser() me?: JwtPayload,
  ) {
    return this.chat.saveMessage({
      channel: body.channel,
      sessionId: body.sessionId ?? '',
      /* ⚠️ Widget нь ЗӨВХӨН хэрэглэгчийн мессеж бичдэг */
      role: 'user',
      text: body.text ?? '',
      userName: body.userName,
      userId: me?.sub,
      titles: body.titles,
    });
  }

  /**
   * n8n workflow-оос нэг дуудлагаар хэрэглэгч+AI хоёрын мессежийг бичнэ.
   *
   * ⚠️ ЯАГААД ТУСДАА ENDPOINT: n8n 2.x task-runner-ийн Code node доторх
   * httpRequest нь workflow-д урьдчилан мэдэгдээгүй ДИНАМИК талбарыг (titles
   * массив) алгасдаг. Тиймээс n8n талд native HTTP Request node-оор энэ рүү
   * НЭГ бүтэн payload илгээнэ.
   */
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @Post('ingest')
  async ingest(
    @Body()
    body: {
      channel?: string;
      sessionId?: string;
      userText?: string;
      assistantText?: string;
      titles?: ChatTitleCard[];
      userName?: string;
    },
  ) {
    const sessionId = (body.sessionId ?? '').trim();
    if (!sessionId) return { ok: true, skipped: true };
    const channel = body.channel ?? 'web';

    if (body.userText?.trim()) {
      await this.chat.saveMessage({
        channel,
        sessionId,
        role: 'user',
        text: body.userText,
        userName: body.userName,
      });
    }
    if (body.assistantText?.trim()) {
      await this.chat.saveMessage({
        channel,
        sessionId,
        role: 'assistant',
        text: body.assistantText,
        titles: body.titles,
      });
    }
    return { ok: true };
  }

  /** Нэвтрэх үед зочны яриаг өөрийн бүртгэлд холбоно */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('link-session')
  linkSession(@Body() body: { sessionId?: string }, @CurrentUser() me: JwtPayload) {
    // ⚠️ userId-г ЗААВАЛ token-оос авна (body-оос БИШ) — session булаалтаас хамгаална
    return this.chat.linkSession(body.sessionId ?? '', me.sub);
  }

  /**
   * ⚠️⚠️ `OptionalJwtAuthGuard` — нэвтэрсэн бол хэн болохыг МЭДНЭ,
   * зочин бол `me` нь `undefined` (хүсэлт унахгүй).
   *
   * Яриа хэрэглэгчид холбогдсон бол ЗӨВХӨН тэр хүн уншина. Урьд нь
   * шалгалт огт байгаагүй тул `sessionId` мэдсэн хүн бусдын ярианы
   * бүх мессеж + ярианаас салгасан ИМЭЙЛийг уншиж чаддаг байв.
   */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('messages')
  messages(
    @Query('sessionId') sessionId: string,
    @CurrentUser() me?: JwtPayload,
    @Query('after') after?: string,
  ) {
    return this.chat.getMessagesForUser(sessionId ?? '', after, me?.sub);
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('unread')
  unread(@Query('sessionId') sessionId: string, @CurrentUser() me?: JwtPayload) {
    return this.chat.getUnreadForUser(sessionId ?? '', me?.sub);
  }
}

/** Олноор устгах хүсэлт (чат/захиалагч/лог бүгдэд ижил хэлбэр) */
class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids: string[];
}

@Controller('admin/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ChatAdminController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('onlyUnread') onlyUnread?: string,
  ) {
    return this.chat.listConversations({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      onlyUnread: onlyUnread === '1' || onlyUnread === 'true',
    });
  }

  @Get('unread-count')
  unreadCount() {
    return this.chat.unreadCount();
  }

  @Get('conversations/:id')
  detail(@Param('id') id: string) {
    return this.chat.getConversation(id);
  }

  @Post('conversations/:id/reply')
  reply(@Param('id') id: string, @Body() body: { text?: string }) {
    return this.chat.adminReply(id, body.text ?? '');
  }

  /** ⚠️ Bulk устгал — тест яриа их хуримтлагддаг тул админд заавал хэрэгтэй */
  @Post('conversations/bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.chat.bulkDelete(dto.ids);
  }

  @Post('conversations/:id/handoff')
  handoff(@Param('id') id: string, @Body() body: { handedOff?: boolean }) {
    return this.chat.setHandoff(id, body.handedOff !== false);
  }
}

@Module({
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
