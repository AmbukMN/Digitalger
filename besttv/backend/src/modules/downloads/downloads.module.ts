import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { assertTitleOnSite } from '../../common/site/site-guard';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * ⚠️⚠️⚠️ ОФЛАЙН ТАТАХ — ЗӨВХӨН ГАР УТАСНЫ АПП.
 *
 * ВЭБ ХӨНДӨГДӨӨГҮЙ: `/stream/*` нь одоогийн байдлаараа ажиллана.
 * Энэ нь ТУСДАА зам (`/downloads/*`) бөгөөс зөвхөн НЭМЭЛТ.
 *
 * ЯАГААД ТУСДАА ВЭ:
 * `/stream/.../variant.m3u8` нь segment бүрийг **4 цагийн** гарын
 * үсэгтэй CDN URL болгож өгдөг. Офлайн татахад тэр хангалтгүй —
 * 50 ангийн цуврал татахад хэдэн цаг зарцуулагдана.
 *
 * ⚠️ ХАМГИЙН ЧУХАЛ ЭРСДЭЛ — DRM БАЙХГҮЙ:
 * Татсан segment нь ердийн `.ts` файл. Root/jailbreak хийсэн
 * төхөөрөмжөөс хуулж болно. Бууруулах арга:
 *   · апп-ын хамгаалагдсан сан (`documentDirectory`) — бусад апп үзэхгүй
 *   · эрх дуусмагц АВТОМАТААР устгана (апп талд heartbeat)
 *   · татах ЭРХИЙГ сервер шалгана (багц/түрээс байхгүй бол өгөхгүй)
 * Бүрэн хамгаалалт нь зөвхөн Widevine/FairPlay — тэр нь нэмэлт өртөгтэй.
 */

/** ⚠️ Нэг хэрэглэгч хэдэн анги татаж болох — 480p-д ≈6GB */
const MAX_DOWNLOADS = 100;

/**
 * ⚠️⚠️ Гарын үсгийн хугацаа — 7 хоног.
 *
 * Татах явцад дуусвал ХАГАС татагдсан файл үлдэнэ. 50 анги × 61MB =
 * 3GB, удаан сүлжээнд хэдэн цаг авна. 7 хоног нь аюулгүй зай.
 *
 * ⚠️ Энэ нь ЭРХИЙН хугацаа БИШ — эрх нь `Download.expiresAt`-аар
 * тусад нь шалгагдана (апп heartbeat хийж устгана).
 */
const SIGN_TTL = 7 * 24 * 3600;

class AuthorizeDto {
  /** ⚠️ `movie` эсвэл `episode` */
  @IsString()
  target: string;

  @IsString()
  targetId: string;

  /**
   * Чанар — `v0` (1080p) / `v1` (720p) / `v2` (480p).
   * ⚠️ Заагаагүй бол 480p — хадгалалт хэмнэнэ (61MB/анги).
   */
  @IsOptional()
  @IsString()
  quality?: string;

  /** Хэдэн хоног хадгалах (эрхийн хугацаанаас хэтрэхгүй) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly subs: SubscriptionsService,
  ) {}

  /**
   * Татах эрх шалгаад segment бүрийн УРТ ХУГАЦААТ URL өгнө.
   *
   * ⚠️ Эрхийг ЗААВАЛ шалгана — эс бөгөөс эрхгүй хэрэглэгч бүх кино
   * татаж авна (playlist нь нээлттэй байсан ч segment нь гарын үсэгтэй,
   * гэвч энэ endpoint тэр гарын үсгийг ӨГЧ байна).
   */
  async authorize(userId: string, dto: AuthorizeDto) {
    const isEpisode = dto.target === 'episode';
    if (!isEpisode && dto.target !== 'movie') {
      throw new BadRequestException('target нь movie эсвэл episode байх ёстой');
    }

    /* ── Контент + эрхийн мэдээлэл ── */
    const info = isEpisode
      ? await this.episodeInfo(dto.targetId)
      : await this.movieInfo(dto.targetId);

    if (!info.videoKey) {
      throw new BadRequestException('Видео бэлэн болоогүй байна');
    }

    /* ⚠️⚠️ ЭРХ — `canAccessTitle(userId, жанрын ID-ууд, titleId)`.
       Жанр нь БАГЦЫН хандалт, `titleId` нь ТҮРЭЭСИЙГ шалгахад хэрэгтэй. */
    const allowed = await this.subs.canAccessTitle(userId, info.genreIds, info.titleId);
    if (!allowed && !info.isFreePreview) {
      throw new ForbiddenException('Энэ контентыг татах эрх байхгүй байна');
    }

    /* ⚠️ Хязгаар — идэвхтэй татацыг тоолно */
    const active = await this.prisma.download.count({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (active >= MAX_DOWNLOADS) {
      throw new BadRequestException(
        `Дээд тал нь ${MAX_DOWNLOADS} анги татаж болно. Хуучныг устгана уу.`,
      );
    }

    /**
     * ⚠️⚠️ ХУГАЦАА — эрхийн хугацаанаас ХЭТРЭХГҮЙ.
     *
     * Багц 5 хоногийн дараа дуусах хүн 30 хоног татаж болохгүй —
     * эс бөгөөс төлбөр төлөхөө больсон ч контент үлдэнэ.
     */
    const rightsEnd = await this.rightsEnd(userId, info.titleId);
    const wantDays = dto.days ?? 30;
    const wantEnd = new Date(Date.now() + wantDays * 86400_000);
    const expiresAt = rightsEnd && rightsEnd < wantEnd ? rightsEnd : wantEnd;

    /* ── Segment жагсаалт ── */
    const quality = /^v[0-9]$/.test(dto.quality ?? '') ? dto.quality! : 'v2';
    const prefix = info.videoKey.slice(0, info.videoKey.lastIndexOf('/') + 1);
    const m3u8Key = `${prefix}${quality}.m3u8`;

    let text: string;
    try {
      text = await this.storage.downloadText(m3u8Key);
    } catch {
      /* ⚠️ Тухайн чанар байхгүй байж болно (богино видеонд 1080p л бий) */
      throw new BadRequestException('Сонгосон чанар байхгүй байна');
    }

    /* ⚠️ Segment бүрд УРТ хугацаат гарын үсэг — татах явцад дуусахгүй */
    const lines = text.split('\n');
    const segments: { name: string; url: string; durationSec: number }[] = [];
    let dur = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('#EXTINF:')) {
        dur = parseFloat(line.slice(8)) || 0;
        continue;
      }
      if (!line || line.startsWith('#')) continue;
      const key = prefix + line;
      const url =
        this.storage.videoCdnUrl(key, SIGN_TTL) ??
        (await this.storage.presignGet(key, SIGN_TTL));
      segments.push({ name: line, url, durationSec: dur });
    }

    if (!segments.length) {
      throw new BadRequestException('Segment олдсонгүй');
    }

    /* ⚠️ Бүртгэл — `upsert`: дахин татахад давхардуулахгүй */
    const rec = await this.prisma.download.upsert({
      where: {
        userId_target_targetId: { userId, target: dto.target, targetId: dto.targetId },
      },
      create: {
        userId,
        target: dto.target,
        targetId: dto.targetId,
        titleId: info.titleId,
        quality,
        expiresAt,
      },
      update: { quality, expiresAt },
    });

    this.logger.log(
      `Офлайн эрх: ${dto.target}/${dto.targetId} → ${segments.length} segment, ` +
        `${expiresAt.toISOString().slice(0, 10)} хүртэл`,
    );

    return {
      downloadId: rec.id,
      titleId: info.titleId,
      title: info.title,
      quality,
      expiresAt,
      /**
       * ⚠️ Апп нь эдгээрийг татаад ЛОКАЛ m3u8 дахин бичнэ (segment мөрийг
       * файлын замаар солино). Плеер локал m3u8-ыг тоглуулна.
       */
      segments,
      /* ⚠️ `#EXT-X-TARGETDURATION` зэрэг толгойг апп локал m3u8-д
         дахин ашиглана — өөрөө зохиовол плеер татгалзана */
      playlistHeader: lines
        .filter((l) => l.trim().startsWith('#') && !l.startsWith('#EXTINF'))
        .join('\n'),
    };
  }

  /** Хэрэглэгчийн татсан контент */
  async list(userId: string) {
    const rows = await this.prisma.download.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        title: { select: { id: true, title: true, slug: true, posterKey: true } },
      },
    });
    const now = new Date();
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        target: r.target,
        targetId: r.targetId,
        quality: r.quality,
        expiresAt: r.expiresAt,
        /* ⚠️ Дууссаныг апп ӨӨРӨӨ устгана — сервер зөвхөн мэдэгдэнэ */
        expired: r.expiresAt <= now,
        title: {
          ...r.title,
          posterUrl: r.title.posterKey
            ? await this.storage.publicAssetUrl(r.title.posterKey, 7200).catch(() => null)
            : null,
        },
      })),
    );
  }

  /**
   * ⚠️⚠️ HEARTBEAT — апп нээгдэх бүрд дуудна.
   *
   * Эрх дууссан татацыг апп УСТГАХ ёстой. Сервер аль нь хүчингүйг
   * хэлнэ — апп локал файлыг арилгана.
   *
   * Энэ нь DRM-ийн ОРЛУУЛАГЧ: төлбөрөө больсон хэрэглэгч контентыг
   * үүрд хадгалахаас сэргийлнэ.
   */
  async check(userId: string) {
    const rows = await this.prisma.download.findMany({
      where: { userId },
      select: { id: true, target: true, targetId: true, titleId: true, expiresAt: true },
    });
    const now = new Date();
    const revoke: string[] = [];

    /* ⚠️ Жанрыг НЭГ query-ээр — эс бөгөөс 100 татацад 100 query явна */
    const tg = await this.prisma.titleGenre.findMany({
      where: { titleId: { in: [...new Set(rows.map((r) => r.titleId))] } },
      select: { titleId: true, genreId: true },
    });
    const genreMap = new Map<string, string[]>();
    for (const g of tg) {
      genreMap.set(g.titleId, [...(genreMap.get(g.titleId) ?? []), g.genreId]);
    }

    for (const r of rows) {
      if (r.expiresAt <= now) {
        revoke.push(r.id);
        continue;
      }
      /* ⚠️ Багцаа цуцалсан/дууссан бол хугацаанаас өмнө ч хүчингүй */
      const gids = (genreMap.get(r.titleId) ?? []);
      const ok = await this.subs.canAccessTitle(userId, gids, r.titleId);
      if (!ok) revoke.push(r.id);
    }

    if (revoke.length) {
      await this.prisma.download.deleteMany({ where: { id: { in: revoke } } });
    }
    return { revoke, valid: rows.length - revoke.length };
  }

  async remove(userId: string, id: string) {
    /* ⚠️ `deleteMany` + userId — өөр хүний бүртгэл устгахаас (IDOR) хамгаална */
    await this.prisma.download.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  /* ── Туслах ── */

  private async episodeInfo(id: string) {
    const e = await this.prisma.episode.findUnique({
      where: { id },
      select: {
        videoKey: true,
        isFreePreview: true,
        season: {
          select: {
            title: {
              select: {
                id: true,
                /**
                 * ⚠️⚠️ `sites` ЗААВАЛ — `Episode`/`Season` нь SHARED модел
                 * (`site` багана АЛГА) тул Prisma шүүлт ч, post-filter ч
                 * ХИЙГДЭХГҮЙ. Ангийн эрхийг ЗӨВХӨН эцэг `Title.sites`
                 * тодорхойлно. Доорх `movieInfo` энэ хамгаалалттай атал
                 * ангийнх мартагдсан байв.
                 */
                sites: true,
                title: true,
                /* ⚠️ Багцын хандалт нь ЖАНРААР шалгагддаг */
                genres: { select: { genreId: true } },
              },
            },
          },
        },
      },
    });
    if (!e) throw new NotFoundException('Анги олдсонгүй');
    /** ⚠️ FAIL-CLOSED: нөгөө сайтын ангийг ТАТУУЛАХГҮЙ */
    assertTitleOnSite(e.season.title.sites, 'Анги олдсонгүй');
    return {
      videoKey: e.videoKey,
      isFreePreview: e.isFreePreview,
      titleId: e.season.title.id,
      title: e.season.title.title,
      genreIds: e.season.title.genres.map((g) => g.genreId),
    };
  }

  private async movieInfo(id: string) {
    const t = await this.prisma.title.findUnique({
      where: { id },
      select: {
        /* ⚠️ `sites` ЗААВАЛ — эс бөгөөс post-filter алгасагдана (fail-open) */
        sites: true,
        id: true,
        title: true,
        videoKey: true,
        isPremium: true,
        genres: { select: { genreId: true } },
      },
    });
    if (!t) throw new NotFoundException('Кино олдсонгүй');
    /* ⚠️ Энэ сайтад нийтлэгдсэн эсэх — нөгөө сайтын киног ТАТУУЛАХГҮЙ */
    assertTitleOnSite(t.sites, 'Кино олдсонгүй');
    return {
      videoKey: t.videoKey,
      isFreePreview: !t.isPremium,
      titleId: t.id,
      title: t.title,
      genreIds: t.genres.map((g) => g.genreId),
    };
  }

  /** Хэрэглэгчийн эрх ХЭЗЭЭ дуусах — багц эсвэл түрээсийн аль урт нь */
  private async rightsEnd(userId: string, titleId: string): Promise<Date | null> {
    const now = new Date();
    const [sub, rental] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { userId, expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      }),
      this.prisma.rental.findFirst({
        where: { userId, titleId, expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      }),
    ]);
    const dates = [sub?.expiresAt, rental?.expiresAt].filter(Boolean) as Date[];
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }
}

@Controller('downloads')
@UseGuards(JwtAuthGuard)
export class DownloadsController {
  constructor(private readonly svc: DownloadsService) {}

  /** Татах эрх + segment-ийн урт хугацаат URL */
  @Post('authorize')
  authorize(@CurrentUser() user: JwtPayload, @Body() dto: AuthorizeDto) {
    return this.svc.authorize(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.svc.list(user.sub);
  }

  /** ⚠️ Апп нээгдэх бүрд — хүчингүй болсон татацыг мэдэгдэнэ */
  @Get('check')
  check(@CurrentUser() user: JwtPayload) {
    return this.svc.check(user.sub);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(user.sub, id);
  }
}

@Module({
  controllers: [DownloadsController],
  providers: [DownloadsService],
})
export class DownloadsModule {}
