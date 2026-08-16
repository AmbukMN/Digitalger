import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { srtToVtt, SUBTITLE_LANGS, subtitleLabel } from '../../common/srt-to-vtt';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

/** ⚠️ Хадмал нь текст — 2MB-аас хэтрэх ёсгүй (3 цагийн кино ~150KB) */
const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

class SubtitleMetaDto {
  @IsString()
  lang: string;

  @IsOptional()
  @IsString()
  label?: string;

  /**
   * ⚠️⚠️ `@IsBoolean()` ХЭРЭГЛЭХГҮЙ — FormData нь БҮХ утгыг МӨР болгодог.
   *
   * БОДИТ АЛДАА: `fd.append('isDefault', 'false')` илгээхэд global pipe-ийн
   * `enableImplicitConversion` нь `"false"` МӨРИЙГ `true` болгодог (хоосон
   * биш мөр = truthy). Үр дүнд нь English оруулахад ТЭР анхдагч болж,
   * Монгол хадмал унтарч байв (админ панелд бодитоор харагдсан).
   *
   * Тиймээс МӨР хэвээр авч, доор гараар задална.
   */
  @IsOptional()
  @IsString()
  isDefault?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

@Injectable()
export class SubtitlesService {
  private readonly logger = new Logger(SubtitlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly subs: SubscriptionsService,
  ) {}

  // ─── АДМИН ────────────────────────────────────────────────────────────────

  /**
   * Хадмал байршуулах — `.srt` эсвэл `.vtt`.
   *
   * ⚠️⚠️ `.srt`-г ЗААВАЛ `.vtt` болгож хөрвүүлнэ. Браузер `.srt`-г ОГТ
   * уншдаггүй бөгөөд алдаа ч өгдөггүй — хадмал зүгээр л ГАРАХГҮЙ.
   * Тэр нь оношлоход маш хэцүү тул эх үүсвэрт нь шийднэ.
   */
  async upload(
    target: { titleId?: string; episodeId?: string },
    file: Express.Multer.File,
    dto: SubtitleMetaDto,
  ) {
    if (!target.titleId && !target.episodeId) {
      throw new BadRequestException('Кино эсвэл анги заавал');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Файл хоосон байна');
    if (file.size > MAX_SUBTITLE_BYTES) {
      throw new BadRequestException('Хадмал хэт том байна (дээд тал нь 2MB)');
    }

    const lang = dto.lang.trim().toLowerCase();
    if (!SUBTITLE_LANGS.some((l) => l.code === lang)) {
      throw new BadRequestException(`Дэмжигдээгүй хэл: ${lang}`);
    }

    /**
     * ⚠️ UTF-8 гэж ҮЗНЭ. Монгол хадмал заримдаа Windows-1251-ээр
     * хадгалагдсан байдаг — тэр үед үсэг эвдэрнэ. Хөрвүүлэлт нь
     * амжилттай болох тул чимээгүй өнгөрөх ба админ хадмалаа
     * харж байж мэднэ. Тиймээс сануулга логлоно.
     */
    const raw = file.buffer.toString('utf8');
    if (raw.includes('�')) {
      this.logger.warn(
        `Хадмалд танигдаагүй тэмдэгт байна — UTF-8 биш байж болзошгүй (${file.originalname})`,
      );
    }

    /* ⚠️ Хөрвүүлэлт унавал ХАДГАЛАХГҮЙ — эвдэрсэн файл R2-д хог болно */
    const { vtt, cues } = srtToVtt(raw);

    const key = this.storage.buildKey(
      target.episodeId ? `subtitles/episodes/${target.episodeId}` : `subtitles/movies/${target.titleId}`,
      `${lang}.vtt`,
    );

    /**
     * ⚠️⚠️ ХУУЧИН ФАЙЛЫГ ТЭМДЭГЛЭНЭ — R2-д хог үлдэхээс сэргийлнэ.
     *
     * БОДИТ АЛДАА: `buildKey` нь ФАЙЛ БҮРД шинэ UUID үүсгэдэг бөгөөд
     * доорх `upsert` нь DB МӨРИЙГ Л шинэчилдэг. Тиймээс хадмал
     * засварлаж дахин оруулах бүрд ХУУЧИН .vtt нь R2-д ҮҮРД үлддэг
     * байв — DB-д ямар ч заалтгүй тул дараа нь олох ч боломжгүй.
     *
     * The Blacklist-ийн 88 хадмалыг нэг удаа дахин оруулахад 88
     * орхигдсон файл үүснэ. Орчуулга засварлах нь ТҮГЭЭМЭЛ үйлдэл.
     */
    const prev = await this.prisma.subtitle
      .findFirst({
        where: target.episodeId
          ? { episodeId: target.episodeId, lang }
          : { titleId: target.titleId, lang },
        select: { fileKey: true },
      })
      .catch(() => null);

    await this.storage.upload(key, Buffer.from(vtt, 'utf8'), 'text/vtt; charset=utf-8');

    /**
     * ⚠️ АНХДАГЧ — нэг видеонд НЭГ л байх ёстой. Шинийг анхдагч
     * болгохоор бусдыг нь автоматаар унтраана (эс бөгөөс player
     * аль нэгийг санамсаргүй сонгоно).
     */
    /**
     * ⚠️⚠️ АНХДАГЧИЙГ ЯГ ЭНЭ ХЭЛ РҮҮ СОЛИНО (админ сонгосон).
     *
     * БОДИТ АЛДАА: `dto.isDefault` нь FormData-аас `"false"` МӨР болж
     * ирээд `enableImplicitConversion` түүнийг `true` болгодог байв.
     * Тиймээс English оруулахад ТЭР анхдагч болж, Монгол унтарч байв.
     *
     * Одоо: мөрийг ЯГ `'true'`-тэй харьцуулна. Хэрэв админ тодорхой
     * заагаагүй бол ЗӨВХӨН монгол хэл автоматаар анхдагч болно.
     */
    const isDefault =
      dto.isDefault != null ? dto.isDefault === 'true' : lang === 'mn';

    if (isDefault) {
      /* ⚠️ Бусдыг унтраана — нэг видеонд НЭГ л анхдагч байна */
      await this.prisma.subtitle.updateMany({
        where: target.episodeId ? { episodeId: target.episodeId } : { titleId: target.titleId },
        data: { isDefault: false },
      });
    }

    const where = target.episodeId
      ? { episodeId_lang: { episodeId: target.episodeId, lang } }
      : { titleId_lang: { titleId: target.titleId!, lang } };

    /* ⚠️ `upsert` — ижил хэл дахин оруулбал СОЛИНО (алдаа өгөхгүй).
       Админ хадмалаа засаад дахин оруулах нь түгээмэл. */
    const row = await this.prisma.subtitle.upsert({
      where,
      create: {
        titleId: target.titleId ?? null,
        episodeId: target.episodeId ?? null,
        lang,
        label: dto.label?.trim() || subtitleLabel(lang),
        fileKey: key,
        isDefault,
        order: dto.order ?? (lang === 'mn' ? 0 : 10),
      },
      update: {
        label: dto.label?.trim() || subtitleLabel(lang),
        fileKey: key,
        isDefault,
        ...(dto.order != null ? { order: dto.order } : {}),
      },
    });

    /**
     * ⚠️ Хуучин файлыг ОДОО устгана — DB аль хэдийн шинэ key рүү
     * заасан тул алдаа гарсан ч хэрэглэгчид нөлөөлөхгүй.
     *
     * ⚠️ `await` ХИЙХГҮЙ (fire-and-forget) — админыг R2-ын хариу
     * хүлээлгэх шаардлагагүй. Гэхдээ алдааг ЗААВАЛ бүртгэнэ: чимээгүй
     * залгивал орхигдсон файлыг дараа нь олох арга байхгүй.
     */
    if (prev?.fileKey && prev.fileKey !== key) {
      void this.storage
        .delete(prev.fileKey)
        .catch((e) =>
          this.logger.error(`Хуучин хадмал устгаж чадсангүй (${prev.fileKey}): ${String(e)}`),
        );
    }

    this.logger.log(`Хадмал орлоо: ${lang} · ${cues} блок · ${key}`);
    return { ...row, cues };
  }

  /** Тухайн кино/ангийн хадмалууд (админд) */
  list(target: { titleId?: string; episodeId?: string }) {
    return this.prisma.subtitle.findMany({
      where: target.episodeId ? { episodeId: target.episodeId } : { titleId: target.titleId },
      orderBy: [{ order: 'asc' }, { lang: 'asc' }],
    });
  }

  /**
   * Анхдагч болгох — тоглуулахад АВТОМАТ асах хэл.
   * ⚠️ Нэг видеонд НЭГ л анхдагч байх тул бусдыг унтраана.
   */
  async setDefault(id: string) {
    const row = await this.prisma.subtitle.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Хадмал олдсонгүй');

    const where = row.episodeId ? { episodeId: row.episodeId } : { titleId: row.titleId };
    await this.prisma.$transaction([
      this.prisma.subtitle.updateMany({ where, data: { isDefault: false } }),
      this.prisma.subtitle.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async remove(id: string) {
    const row = await this.prisma.subtitle.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Хадмал олдсонгүй');
    /* ⚠️ R2-оос ч устгана — эс бөгөөс хог файл хуримтлагдана */
    await this.storage.delete(row.fileKey).catch(() => null);
    await this.prisma.subtitle.delete({ where: { id } });

    /**
     * ⚠️⚠️ АНХДАГЧГҮЙ ҮЛДЭХЭЭС СЭРГИЙЛНЭ.
     *
     * Анхдагч хадмалыг устгавал үлдсэн нь бүгд `isDefault: false`
     * болно. Тэр үед player нь ЯМАР Ч хадмал автоматаар асаахгүй —
     * хэрэглэгч цэс рүү орж гараар сонгох ёстой болно.
     *
     * Тиймээс үлдсэнээс НЭГИЙГ анхдагч болгоно: монгол байвал тэр,
     * эс бөгөөс эрэмбээр эхнийх.
     */
    if (row.isDefault) {
      const where = row.episodeId ? { episodeId: row.episodeId } : { titleId: row.titleId };
      const next = await this.prisma.subtitle.findFirst({
        where,
        /* ⚠️ Монгол хэлийг ЭХЭНД — `lang: 'asc'` бол «en» түрүүлнэ */
        orderBy: [{ lang: 'asc' }, { order: 'asc' }],
      });
      const mn = await this.prisma.subtitle.findFirst({ where: { ...where, lang: 'mn' } });
      const pick = mn ?? next;
      if (pick) {
        await this.prisma.subtitle.update({
          where: { id: pick.id },
          data: { isDefault: true },
        });
        this.logger.log(`Анхдагч хадмал ${pick.lang} руу шилжлээ (өмнөх нь устсан)`);
      }
    }

    return { ok: true };
  }

  // ─── НИЙТИЙН (player) ─────────────────────────────────────────────────────

  /**
   * Player-т харуулах хадмалын ЖАГСААЛТ (агуулга биш).
   *
   * ⚠️ Эрх ШАЛГАХГҮЙ — зөвхөн «ямар хэл байгаа» гэдгийг хэлнэ.
   * Агуулгыг татахад л эрх шалгана. Ингэснээр эрхгүй хэрэглэгч ч
   * «энэ кино англи хадмалтай» гэдгийг мэдэж, худалдан авах шийдвэр
   * гаргана.
   */
  async publicList(kind: 'movie' | 'episode', id: string) {
    const rows = await this.prisma.subtitle.findMany({
      where: kind === 'episode' ? { episodeId: id } : { titleId: id },
      orderBy: [{ order: 'asc' }, { lang: 'asc' }],
      select: { id: true, lang: true, label: true, isDefault: true },
    });
    return rows.map((r) => ({
      ...r,
      /* ⚠️ R2 хаяг ОГТ өгөхгүй — зөвхөн манай API дамжина (доор) */
      src: `/api/subtitles/${kind}/${id}/${r.lang}.vtt`,
    }));
  }

  /**
   * Хадмалын АГУУЛГА — эрх шалгаад ӨӨРСДӨӨ дамжуулна.
   *
   * ⚠️⚠️ R2 ХАЯГ ОГТ ӨГӨХГҮЙ (presign ч биш). Видеоны сегмент нь
   * presign-ээр шууд R2-оос татагддаг ч ХАДМАЛЫГ тэгэж БОЛОХГҮЙ:
   *   • Хадмал бол текст — татагдвал шууд хуулагдана
   *   • Бусад сайтууд манай орчуулгыг чөлөөтэй ашиглана
   *   • Файл жижиг тул backend дамжуулах нь ачаалал БАРАГ өгөхгүй
   *
   * ⚠️ Эрхийн шалгалт нь ВИДЕОТОЙ ЯГ ИЖИЛ — хадмалыг видеонээс
   * тусад нь татах боломжгүй байх ёстой.
   */
  async content(kind: 'movie' | 'episode', id: string, lang: string, userId?: string | null) {
    const row = await this.prisma.subtitle.findFirst({
      where: kind === 'episode' ? { episodeId: id, lang } : { titleId: id, lang },
      select: { fileKey: true },
    });
    if (!row) throw new NotFoundException('Хадмал олдсонгүй');

    await this.assertAccess(kind, id, userId);

    const text = await this.storage.downloadText(row.fileKey).catch(() => null);
    if (!text) throw new NotFoundException('Хадмалын файл олдсонгүй');
    return text;
  }

  /**
   * ⚠️⚠️ ВИДЕОТОЙ ИЖИЛ ЭРХИЙН ШАЛГАЛТ.
   *
   * Хадмалыг задгай өгвөл: төлбөргүй хүн орчуулгыг татаж аваад
   * ӨӨР САЙТААС үзнэ. Манай гол давуу тал (монгол орчуулга) шууд
   * алдагдана. Тиймээс видеотой ЯГ ижил хатуу.
   *
   * ⚠️ Үнэгүй анги (`isFreePreview`) бол хадмал ч үнэгүй — эс бөгөөс
   * танилцуулга анги хадмалгүй болж утгагүй болно.
   */
  private async assertAccess(kind: 'movie' | 'episode', id: string, userId?: string | null) {
    if (kind === 'episode') {
      const ep = await this.prisma.episode.findUnique({
        where: { id },
        select: {
          isFreePreview: true,
          isVisible: true,
          season: {
            select: {
              isVisible: true,
              title: {
                select: { id: true, isPremium: true, genres: { select: { genreId: true } } },
              },
            },
          },
        },
      });
      if (!ep) throw new NotFoundException('Анги олдсонгүй');
      /* ⚠️ Админ нуусан анги — хадмал ч гарахгүй (видеотой ижил хаалт) */
      if (!ep.isVisible || !ep.season.isVisible) {
        throw new NotFoundException('Анги олдсонгүй');
      }
      const t = ep.season.title;
      /* Үнэгүй танилцуулга анги — хадмал ч нээлттэй */
      if (!t.isPremium || ep.isFreePreview) return;
      await this.check(t.id, t.genres.map((g) => g.genreId), userId);
      return;
    }

    const title = await this.prisma.title.findUnique({
      where: { id },
      select: { id: true, isPremium: true, genres: { select: { genreId: true } } },
    });
    if (!title) throw new NotFoundException('Кино олдсонгүй');
    if (!title.isPremium) return;
    await this.check(title.id, title.genres.map((g) => g.genreId), userId);
  }

  private async check(titleId: string, genreIds: string[], userId?: string | null) {
    const ok = await this.subs.canAccessTitle(userId, genreIds, titleId);
    if (!ok) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Энэ контентыг үзэхэд багц эсвэл түрээс шаардлагатай',
      });
    }
  }
}

// ─── НИЙТИЙН CONTROLLER ──────────────────────────────────────────────────────

@Controller('subtitles')
export class SubtitlesController {
  constructor(private readonly svc: SubtitlesService) {}

  /** Ямар хэл байгаа (эрх шаардахгүй) */
  @Get(':kind/:id')
  list(@Param('kind') kind: 'movie' | 'episode', @Param('id') id: string) {
    return this.svc.publicList(kind === 'episode' ? 'episode' : 'movie', id);
  }

  /**
   * Хадмалын агуулга.
   *
   * ⚠️ `Content-Type: text/vtt` ЗААВАЛ — эс бөгөөс браузер `<track>`-ыг
   * танихгүй, хадмал ЧИМЭЭГҮЙ гарахгүй.
   * ⚠️ `private` кэш — CDN дээр кэшлэгдвэл эрхгүй хүнд ч хүрнэ.
   */
  @Get(':kind/:id/:lang.vtt')
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Content-Type', 'text/vtt; charset=utf-8')
  @Header('Cache-Control', 'private, max-age=300')
  content(
    @Param('kind') kind: 'movie' | 'episode',
    @Param('id') id: string,
    @Param('lang') lang: string,
    @CurrentUser() user: JwtPayload | null,
  ) {
    return this.svc.content(
      kind === 'episode' ? 'episode' : 'movie',
      id,
      lang.toLowerCase(),
      user?.sub,
    );
  }
}

// ─── АДМИН CONTROLLER ────────────────────────────────────────────────────────

@Controller('admin/subtitles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SubtitlesAdminController {
  constructor(private readonly svc: SubtitlesService) {}

  /** Дэмжигдэх хэлүүд — админ цэс дүүргэхэд */
  @Get('langs')
  langs() {
    return SUBTITLE_LANGS;
  }

  @Get('movie/:titleId')
  listMovie(@Param('titleId') titleId: string) {
    return this.svc.list({ titleId });
  }

  @Get('episode/:episodeId')
  listEpisode(@Param('episodeId') episodeId: string) {
    return this.svc.list({ episodeId });
  }

  /**
   * ⚠️ `memoryStorage` — хадмал жижиг (макс 2MB) тул дискэнд бичих
   * шаардлагагүй. Видеонээс ЯЛГААТАЙ (тэр нь GB хэмжээтэй).
   */
  @Post('movie/:titleId')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_SUBTITLE_BYTES } }))
  uploadMovie(
    @Param('titleId') titleId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubtitleMetaDto,
  ) {
    return this.svc.upload({ titleId }, file, dto);
  }

  @Post('episode/:episodeId')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_SUBTITLE_BYTES } }))
  uploadEpisode(
    @Param('episodeId') episodeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubtitleMetaDto,
  ) {
    return this.svc.upload({ episodeId }, file, dto);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.svc.setDefault(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  imports: [SubscriptionsModule],
  controllers: [SubtitlesController, SubtitlesAdminController],
  providers: [SubtitlesService],
  exports: [SubtitlesService],
})
export class SubtitlesModule {}
