import { BullModule, InjectQueue } from '@nestjs/bull';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Query,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { Role, SocialChannel } from '@prisma/client';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CrosspostService } from './crosspost.service';
import { MetaGraphService } from './meta-graph.service';
import { CROSSPOST_QUEUE, type CrosspostJob } from './crosspost-queue.types';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocialService } from '../social/social.service';
import { SocialModule } from '../social/social.module';

class EnqueueDto {
  @IsArray()
  @IsString({ each: true })
  fbPostIds: string[];

  /** Постын ID → өөрчилсөн caption (заавал биш) */
  @IsOptional()
  @IsObject()
  captions?: Record<string, string>;
}

/**
 * Facebook постуудыг Instagram руу шилжүүлэх админ хэсэг.
 *
 * ⚠️ FB болон IG нь Meta дээр холбоотой ч Meta нь автомат хөндлөн
 * нийтлэлийг ЗӨВХӨН гараар, пост бүрд өгдөг. Энэ модуль нь БӨӨНӨӨР
 * хийх боломжийг нэмнэ.
 */
@Controller('admin/crosspost')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CrosspostAdminController {
  constructor(
    private readonly svc: CrosspostService,
    private readonly meta: MetaGraphService,
    private readonly prisma: PrismaService,
    /**
     * ⚠️⚠️ ЭРГЭЛТИЙН ХАМААРАЛ: `SocialModule` нь `CrosspostModule`-ыг
     * импортолдог (Meta нийтлэх логикийг дахин ашиглахын тулд).
     * Урвуу чиглэлд шууд импортлобол Nest эхлэхдээ унана —
     * `forwardRef` ЗААВАЛ.
     */
    @Inject(forwardRef(() => SocialService))
    private readonly social: SocialService,
    @InjectQueue(CROSSPOST_QUEUE) private readonly queue: Queue<CrosspostJob>,
  ) {}

  /** Холболтын төлөв — админд юу дутуугаа шууд харуулна */
  @Get('status')
  async status() {
    const limit = this.meta.isIgConfigured() ? await this.meta.publishingLimit() : null;
    return {
      fbConfigured: this.meta.isConfigured(),
      igConfigured: this.meta.isIgConfigured(),
      /* IG-ийн 24 цагийн нийтлэлийн хязгаар (50) */
      quota: limit,
    };
  }

  /** Facebook постуудыг татах (шилжүүлэлтийн төлөвтэй нь хамт) */
  @Get('posts')
  posts(@Query('limit') limit?: string, @Query('after') after?: string) {
    return this.svc.listPosts(Number(limit) || 25, after);
  }

  /** Сонгосон постуудыг дараалалд оруулна */
  @Post('enqueue')
  async enqueue(@Body() dto: EnqueueDto) {
    const res = await this.svc.enqueue(dto.fbPostIds, dto.captions);

    /* ⚠️ Дараалалд Bull ажил нэмнэ — worker нь ганц ганцаар боловсруулна */
    for (const crosspostId of res.queued) {
      await this.queue.add(
        'publish',
        { crosspostId },
        {
          /* ⚠️ 2 оролдлого — Meta түр саатвал өөрөө сэргэнэ. Илүү олон
             оролдвол хязгаар дүүрэх эрсдэлтэй. */
          attempts: 2,
          backoff: { type: 'fixed', delay: 60_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    }
    return res;
  }

  /** Амжилтгүй болсныг дахин оролдох */
  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    await this.prisma.socialCrosspost.update({
      where: { id },
      /* ⚠️ `attempts` тэглэнэ — эс бөгөөс 3-т хүрсэн мөр дахин
         оролдох боломжгүй үлдэнэ */
      data: { status: 'QUEUED', error: null, attempts: 0 },
    });
    await this.queue.add(
      'publish',
      { crosspostId: id },
      { attempts: 2, backoff: { type: 'fixed', delay: 60_000 }, removeOnComplete: 100 },
    );
    return { ok: true };
  }

  /**
   * ⚠️ ХУУЧИН FB ПОСТЫГ «НИЙТЛЭЛ ТОВЛОГЧ» РУУ ИМПОРТЛОНО.
   *
   * Медиаг R2 руу татаад ноорог пост үүсгэнэ. Админ дараа нь
   * товлогчоос засаж, FB/IG-д хэдэн ч удаа товлож болно.
   */
  @Post(':id/to-scheduler')
  async toScheduler(@Param('id') fbPostId: string, @CurrentUser() me?: JwtPayload) {
    const data = await this.svc.importToScheduler(fbPostId);

    /**
     * ⚠️ Анхдагчаар ЗӨВХӨН FACEBOOK — IG нь медиа шаарддаг тул
     * текст постод сонгоод өгвөл товлогч татгалзана. Админ өөрөө
     * нэмнэ.
     */
    const channels: SocialChannel[] = data.mediaKeys.length
      ? [SocialChannel.FACEBOOK, SocialChannel.INSTAGRAM]
      : [SocialChannel.FACEBOOK];

    const created = await this.social.upsert({
      body: data.body,
      mediaKeys: data.mediaKeys,
      channels,
      createdById: me?.sub,
    });
    return { ...created, importedKind: data.kind };
  }

  /** Шилжүүлэлтийн түүх */
  @Get('history')
  history(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.history({ status, page: Number(page), limit: Number(limit) });
  }

  /**
   * Бүртгэлийг устгах.
   *
   * ⚠️ Instagram дээрх постыг УСТГАХГҮЙ — зөвхөн энд байгаа бүртгэл.
   * Устгасны дараа тухайн FB постыг ДАХИН шилжүүлэх боломжтой болно.
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.socialCrosspost.delete({ where: { id } });
    return { ok: true };
  }
}

@Module({
  imports: [
    BullModule.registerQueue({ name: CROSSPOST_QUEUE }),
    /* ⚠️ Эргэлтийн хамаарал — дээрх тайлбарыг үзнэ үү */
    forwardRef(() => SocialModule),
  ],
  controllers: [CrosspostAdminController],
  /* ⚠️ StorageService нэмэхгүй — StorageModule нь @Global */
  providers: [CrosspostService, MetaGraphService],
  exports: [CrosspostService, MetaGraphService],
})
export class CrosspostModule {}
