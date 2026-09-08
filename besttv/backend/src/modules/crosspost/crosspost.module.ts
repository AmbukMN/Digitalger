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
import { SocialAccountsService } from './social-accounts.service';
import { RelayService } from './relay.service';
import { CROSSPOST_QUEUE, type CrosspostJob } from './crosspost-queue.types';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocialService } from '../social/social.service';
import { SocialModule } from '../social/social.module';
import { assertSameSite } from '../../common/site/site-guard';

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
 * ⚠️⚠️ PAGE ХООРОНД ДАМЖУУЛАХ — эх page-ээс сонгосон постуудыг
 * зорилтот акаунтууд руу ШИНЭЭР нийтэлнэ.
 *
 * ⚠️ Meta-д «хуваалцах» (share) API БАЙХГҮЙ — постыг ШИНЭЭР үүсгэнэ.
 *    Эх постын текст + зургийг хуулж, шинэ пост болгоно.
 */
class RelayDto {
  /** Эх page ID */
  @IsString()
  fromId: string;

  /** Дамжуулах постуудын ID */
  @IsArray()
  @IsString({ each: true })
  postIds: string[];

  /** Зорилтот акаунтууд (page эсвэл IG) */
  @IsArray()
  @IsString({ each: true })
  toIds: string[];

  /** Постын ID → өөрчилсөн текст (заавал биш) */
  @IsOptional()
  @IsObject()
  captions?: Record<string, string>;

  /**
   * ⚠️ Хэзээ нийтлэх (ISO). Хоосон бол ШУУД.
   * FB нь ӨӨРӨӨ товлодог (`scheduled_publish_time`), IG-д тийм
   * боломж БАЙХГҮЙ тул сервис талд ялгаатай зохицуулна.
   */
  @IsOptional()
  @IsString()
  scheduledAt?: string;
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
    private readonly accounts: SocialAccountsService,
    private readonly relaySvc: RelayService,
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

  /**
   * ⚠️⚠️ ХОЛБОГДСОН БҮХ PAGE / IG — токенуудаас АВТОМАТААР илрүүлнэ.
   *
   * Админ гараар ID бичих шаардлагагүй. `?refresh=1` бол кэшийг
   * тойрч дахин татна (токен сольсны дараа).
   */
  @Get('accounts')
  accounts_(@Query('refresh') refresh?: string) {
    return this.accounts.listPublic(refresh === '1');
  }

  /** ДУРЫН page-ийн постууд (дамжуулалтын төлөвтэй нь хамт) */
  @Get('accounts/:id/posts')
  accountPosts(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('after') after?: string,
  ) {
    return this.relaySvc.listPosts(id, Number(limit) || 25, after);
  }

  /** Page → Page / Page → IG дамжуулалт */
  @Post('relay')
  relay(@Body() dto: RelayDto) {
    return this.relaySvc.relay({
      fromId: dto.fromId,
      postIds: dto.postIds,
      toIds: dto.toIds,
      captions: dto.captions,
      scheduledAt: dto.scheduledAt,
    });
  }

  /** Дамжуулалтын түүх */
  @Get('relay/history')
  relayHistory(@Query('limit') limit?: string) {
    return this.relaySvc.history(Number(limit) || 50);
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
    /* ⚠️ САЙТ ХООРОНД БИЧИХЭЭС — `site-guard.ts` тайлбарыг үз */
    await assertSameSite(this.prisma.socialCrosspost, id, 'Пост олдсонгүй');
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
    /* ⚠️ Явцын цонхонд харуулах статистик — медиа хэд, хэдэн МБ,
       хэд нь унасан. Эдгээргүй бол админ юу татагдсаныг мэдэхгүй. */
    return {
      ...created,
      importedKind: data.kind,
      mediaTotal: data.mediaTotal,
      mediaFailed: data.mediaFailed,
      bytes: data.bytes,
      isVideo: data.isVideo,
    };
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
    /* ⚠️ САЙТ ХООРОНД УСТГАХААС — эргэлт буцалтгүй тул ЗААВАЛ */
    await assertSameSite(this.prisma.socialCrosspost, id, 'Бүртгэл олдсонгүй');
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
  providers: [CrosspostService, MetaGraphService, SocialAccountsService, RelayService],
  exports: [CrosspostService, MetaGraphService],
})
export class CrosspostModule {}
