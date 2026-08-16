import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, SocialChannel } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CrosspostModule } from '../crosspost/crosspost.module';
import { SocialService } from './social.service';
import { SocialPublisherService } from './social-publisher.service';
import { SocialSchedulerService } from './social-scheduler.service';

// ─── DTO ──────────────────────────────────────────────────────────────────

class UpsertPostDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  /* ⚠️ FB-ийн дээд хязгаар — түүнээс урт нь ямар ч сувагт орохгүй */
  @MaxLength(63_206)
  body: string;

  @IsArray()
  @IsString({ each: true })
  /* ⚠️ IG carousel дээд тал нь 10 (Meta баримт) */
  @ArrayMaxSize(10)
  mediaKeys: string[];

  @IsArray()
  @IsEnum(SocialChannel, { each: true })
  @ArrayMaxSize(2)
  channels: SocialChannel[];

  /** Суваг тус бүрийн текст — `{ FACEBOOK: '...', INSTAGRAM: '...' }` */
  @IsOptional()
  captions?: Record<string, string>;

  @IsOptional()
  @IsString()
  titleId?: string | null;

  /**
   * ДАХИН НИЙТЛЭХ (evergreen) — `{ gap, freq, expireCount, done }`.
   * ⚠️ `null` = давтахгүй.
   */
  @IsOptional()
  recycle?: {
    gap?: number;
    freq?: 'DAY' | 'WEEK' | 'MONTH';
    expireCount?: number;
    done?: number;
  } | null;
}

class ScheduleDto {
  /**
   * ISO огноо. Байхгүй бол ДАРААГИЙН СУЛ SLOT (Buffer-ийн
   * «Next Available»).
   */
  @IsOptional()
  @IsISO8601()
  at?: string;
}

class SlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  /* ⚠️ "HH:MM" 24 цагийн формат — өөр хэлбэр slot тооцоог эвдэнэ */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Цаг "HH:MM" хэлбэртэй байна' })
  time: string;
}

class SetSlotsDto {
  @IsEnum(SocialChannel)
  channel: SocialChannel;

  @IsArray()
  @Type(() => SlotDto)
  /* ⚠️ Долоо хоногт 7×24 = 168-аас олон slot утгагүй */
  @ArrayMaxSize(50)
  slots: SlotDto[];
}

class PauseDto {
  @IsEnum(SocialChannel)
  channel: SocialChannel;

  @IsBoolean()
  paused: boolean;
}

class ValidateDto {
  @IsString()
  body: string;

  @IsArray()
  @IsString({ each: true })
  mediaKeys: string[];

  @IsArray()
  @IsEnum(SocialChannel, { each: true })
  channels: SocialChannel[];

  @IsOptional()
  captions?: Record<string, string>;
}

// ─── Controller ───────────────────────────────────────────────────────────

/**
 * ⚠️ ЗӨВХӨН АДМИН — нийтлэл нь брэндийн нүүр царай.
 */
@Controller('admin/social')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SocialController {
  constructor(
    private readonly svc: SocialService,
    private readonly publisher: SocialPublisherService,
  ) {}

  @Get('posts')
  list(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('posts/:id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('posts')
  upsert(@Body() dto: UpsertPostDto, @CurrentUser() me?: JwtPayload) {
    return this.svc.upsert({
      id: dto.id,
      body: dto.body,
      mediaKeys: dto.mediaKeys,
      channels: dto.channels,
      captions: dto.captions as Partial<Record<SocialChannel, string>>,
      titleId: dto.titleId,
      recycle: dto.recycle,
      createdById: me?.sub,
    });
  }

  @Delete('posts/:id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  /** Товлох — огноогүй бол дараагийн сул slot */
  @Post('posts/:id/schedule')
  schedule(@Param('id') id: string, @Body() dto: ScheduleDto) {
    return this.svc.schedule({ postId: id, at: dto.at ? new Date(dto.at) : null });
  }

  @Post('posts/:id/unschedule')
  unschedule(@Param('id') id: string) {
    return this.svc.unschedule(id);
  }

  /** ОДОО нийтлэх — товлолгүйгээр шууд */
  @Post('posts/:id/publish-now')
  async publishNow(@Param('id') id: string) {
    const post = await this.svc.get(id);

    /**
     * ⚠️⚠️ ВАЛИДАЦИ ЭНД Ч ЗААВАЛ — `schedule()` нь `block` асуудалд
     * татгалздаг атал энэ зам түүнийг ТОЙРДОГ байв. Үр дүнд «медиагүй
     * IG пост» шууд Meta руу явж алдаа авдаг.
     */
    const captions: Partial<Record<SocialChannel, string>> = {};
    for (const t of post.targets) if (t.caption) captions[t.channel] = t.caption;
    const blocking = this.svc
      .validate({
        channels: post.targets.map((t) => t.channel),
        captions,
        body: post.body,
        mediaKeys: post.mediaKeys,
      })
      .filter((i) => i.level === 'block');

    if (blocking.length) {
      throw new BadRequestException(
        `Нийтлэх боломжгүй: ${blocking.map((b) => b.message).join(' · ')}`,
      );
    }

    /* ⚠️ Товлолтыг ЦУЦЛАНА — эс бөгөөс cron дахин илгээнэ */
    await this.svc.unschedule(id).catch(() => null);

    /**
     * ⚠️ `fbNativeScheduled` цэвэрлэнэ — өнгөрсөн цагтай товлолт
     * Meta руу явбал «10 мин – 30 хоног» алдаа гарна.
     */
    await this.svc.clearNativeSchedule(id);

    for (const t of post.targets) {
      await this.publisher.publishTarget(t.id);
    }
    return this.svc.get(id);
  }

  /**
   * ЗӨВХӨН УНАСАН сувгуудыг дахин.
   * ⚠️ Нийтлэгдсэнийг хөндөхгүй — давхар пост үүсгэхгүй.
   */
  @Post('posts/:id/retry')
  async retry(@Param('id') id: string) {
    const n = await this.publisher.retryFailed(id);
    return { retried: n };
  }

  /** Нийтэлсэн постыг шинэ draft болгож хуулах */
  @Post('posts/:id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.svc.duplicate(id);
  }

  /** Зохиох үед шалгах — товлохоос ӨМНӨ алдааг барина */
  @Post('validate')
  validate(@Body() dto: ValidateDto) {
    return {
      issues: this.svc.validate({
        channels: dto.channels,
        captions: (dto.captions ?? {}) as Partial<Record<SocialChannel, string>>,
        body: dto.body,
        mediaKeys: dto.mediaKeys,
      }),
    };
  }

  // ─── Хуваарь ────────────────────────────────────────────────────────────

  @Get('slots')
  slots() {
    return this.svc.listSlots();
  }

  @Post('slots')
  setSlots(@Body() dto: SetSlotsDto) {
    return this.svc.setSlots(dto.channel, dto.slots);
  }

  // ─── Сувгийн тохиргоо ───────────────────────────────────────────────────

  @Get('channels')
  async channels() {
    const [settings, quota] = await Promise.all([
      this.svc.channelSettings(),
      this.svc.quota().catch(() => null),
    ]);
    return { paused: settings, igQuota: quota };
  }

  @Patch('channels/pause')
  pause(@Body() dto: PauseDto) {
    return this.svc.setPaused(dto.channel, dto.paused);
  }
}

@Module({
  /* ⚠️ `MetaGraphService`-ыг дахин ашиглана — FB/IG нийтлэх бүх
     логик тэнд бий (crosspost модулиас экспортлогдсон) */
  imports: [CrosspostModule],
  controllers: [SocialController],
  providers: [SocialService, SocialPublisherService, SocialSchedulerService],
  exports: [SocialService],
})
export class SocialModule {}
