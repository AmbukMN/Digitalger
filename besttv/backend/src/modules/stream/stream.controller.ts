import { Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { StreamService } from './stream.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * ⚠️⚠️ PLAYLIST-ЫГ BROWSER-Т 2 МИНУТ КЭШЛҮҮЛНЭ (`private, max-age=120`).
 *
 * Өмнө нь `no-store` байсан тул player нь seek хийх бүрт, чанар солих
 * бүрт playlist-ыг СЕРВЕРЭЭС ДАХИН татдаг байв. Монгол↔Герман хооронд
 * дуудалт тутам ~0.4-0.8 СЕКУНД — хэрэглэгч "seek хийхэд удаан уншиж
 * байна" гэж мэдэрдэг гол шалтгаан.
 *
 * ⚠️ 10 минут (600с) БАЙСНЫГ 2 МИНУТ болгов: playlist дотор presigned URL
 * байдаг тул урт кэш нь ХУУЧИРСАН холбоосыг барьж, R2 тохиргоо
 * (жишээ нь CORS) солигдоход browser хуучин URL-аар дуудсаар алдаа өгдөг
 * байв. 2 минут нь seek-ийн хурдыг хадгалж, хуучирлаас хамгаална.
 *
 * ЯАГААД АЮУЛГҮЙ ВЭ:
 *   - `private` = зөвхөн тухайн хэрэглэгчийн browser (CDN/proxy кэшлэхгүй)
 *   - Эрхийн шалгалт нь guard дээр, хүсэлт БҮРТ хийгдсээр байна
 *     (кэш нь browser-ийн дотоод — эрх алдагдахгүй)
 */

/**
 * АДМИН PREVIEW — байршуулсан видеогоо шалгах.
 *
 * ⚠️ Тусдаа controller: нийтийн /stream нь OptionalJwtAuthGuard-тай тул
 * түүн дотор ADMIN-only маршрут тавьбал guard зөрчилдөнө.
 */
@Controller('admin/stream')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@SkipThrottle({ default: true, short: true, medium: true, long: true })
export class AdminStreamController {
  constructor(private readonly stream: StreamService) {}

  @Get('movie/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  movie(@Param('titleId') titleId: string) {
    return this.stream.adminPreview('movie', titleId);
  }

  /**
   * Хуучин кинонуудад seek thumbnail НӨХӨХ.
   * ⚠️ Удаан ажиллана (кино бүрийг ffmpeg-ээр уншина) тул нэг дуудалтад
   * цөөхөн боловсруулна — дахин дуудаж үргэлжлүүлнэ (аль хэдийн
   * үүссэнийг алгасдаг).
   */
  @Post('thumbnails/backfill')
  backfillThumbs(@Query('limit') limit?: string) {
    return this.stream.backfillThumbnails(Math.min(20, Number(limit) || 5));
  }

  /**
   * ХАР ПОСТЕРЫГ дахин үүсгэх (кино + анги).
   *
   * ⚠️ Постерыг өмнө нь 1 дэх секундээс авдаг байсан тул хар дэлгэц/
   * лого гардаг байв. Одоо 10%-д авдаг ч ӨМНӨ хөрвүүлсэн видео хэвээр.
   *
   * ⚠️ `?force=1` — 5 KB-ээс ТОМ постерыг ч дарж бичнэ (админ гараар
   * оруулсан зураг байвал болгоомжтой).
   */
  @Post('posters/backfill')
  backfillPosters(@Query('limit') limit?: string, @Query('force') force?: string) {
    return this.stream.backfillPosters(
      Math.min(30, Number(limit) || 10),
      force === '1' || force === 'true',
    );
  }


  @Get('episode/:episodeId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  episode(@Param('episodeId') episodeId: string) {
    return this.stream.adminPreview('episode', episodeId);
  }

  @Get('trailer/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  trailer(@Param('titleId') titleId: string) {
    return this.stream.adminPreview('trailer', titleId);
  }

  /**
   * ⚠️ ABR дэд playlist — master доторх мөрүүд ЭНД заана.
   * Ингэснээр segment-үүд presign хийгдэж, админ preview тоглоно.
   */
  @Get(':kind/:id/variant.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  variant(
    @Param('kind') kind: 'movie' | 'episode' | 'trailer',
    @Param('id') id: string,
    @Query('v') v: string,
  ) {
    return this.stream.adminVariant(kind, id, v);
  }
}

// ⚠️ OptionalJwtAuthGuard — үнэгүй контентыг нэвтрээгүй хүн ч үзнэ.
// Premium эрх шалгалт service дотор (assertAccess).
/**
 * ⚠️⚠️ RATE LIMIT ХАМААРУУЛАХГҮЙ (`@SkipThrottle`).
 *
 * Глобал `short` хязгаар нь 1 СЕКУНДЭД 20 ХҮСЭЛТ. Гэтэл hls.js нь:
 *   - ABR чанар солих бүрт `variant.m3u8` дуудна
 *   - Seek хийхэд шинэ байрлалын playlist-ыг ДАХИН татна
 *   - Алдаа гарвал `checkRetry`-аар олон удаа давтана
 * тул секундэд хэдэн арван хүсэлт явуулдаг → лимит хэтэрч 403 Forbidden.
 *
 * Production nginx лог үүнийг тодорхой харуулав: ЯГ ИЖИЛ URL заримдаа
 * 200, заримдаа 403 — эрхийн алдаа биш, rate limit.
 *
 * ⚠️⚠️ ЗААВАЛ БҮХ throttler-ийн НЭРИЙГ бичнэ:
 *   `@SkipThrottle()` (хоосон) нь ЗӨВХӨН `default`-ыг алгасдаг. Манай
 *   `app.module.ts`-д `short`/`medium`/`long` гэсэн НЭРЛЭСЭН throttler-ууд
 *   бий тул тэдгээрийг нэрээр нь заахгүй бол `short` (20 хүсэлт/сек)
 *   ХЭВЭЭР үйлчилж, 429 буцаасаар байна.
 *   Production burst тест үүнийг батлав: хоосон `@SkipThrottle()` үед
 *   эхний 20 хүсэлт өнгөрч, 21-ээс 429 гарч байв.
 *
 * ⚠️ Аюулгүй байдал АЛДАГДАХГҮЙ: эрхийн шалгалт (`assertAccess`) хүсэлт
 * бүрт хийгдсээр байна. Rate limit нь зөвхөн ДАВТАМЖИЙН хамгаалалт бөгөөд
 * видео урсгалд утгагүй — нэг хэрэглэгч кино үзэхэд л олон хүсэлт явна.
 *
 * ⚠️⚠️ ГЭХДЭЭ БҮРЭН ХЯЗГААРГҮЙ БИШ — `default` throttler ҮЛДЭНЭ.
 *
 * `short`/`medium`/`long` нь дээрх шалтгаанаар унтарсан, харин
 * `default`-ыг 600/мин болгож үлдээв. Эс бөгөөс нэг эрхтэй хэрэглэгч
 * (эсвэл 4,900₮-өөр НЭГ кино түрээсэлсэн хүн) `variant.m3u8`-ыг
 * хязгааргүй давтан дуудаж болно — дуудалт бүр DB query + (кэш хоосон
 * үед) R2 `downloadText` + segment бүрд presign үүсгэдэг тул хэдхэн
 * клиентээр backend-ийг ачаалж болох байв.
 *
 * ⚠️ 600/мин нь бодит үзэлтээс ХАМААГҮЙ өндөр: HLS плеер 6 секундын
 * segment-тэй тул минутад ~10 playlist дуудалт хийнэ. 60 дахин нөөцтэй
 * — жинхэнэ хэрэглэгч ХЭЗЭЭ Ч цохихгүй, харин скриптийн үер зогсоно.
 */
@Controller('stream')
@UseGuards(OptionalJwtAuthGuard)
@SkipThrottle({ short: true, medium: true, long: true })
@Throttle({ default: { limit: 600, ttl: 60_000 } })
export class StreamController {
  constructor(private readonly stream: StreamService) {}

  @Get('movie/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  movie(@Param('titleId') titleId: string, @CurrentUser() user: JwtPayload | null) {
    return this.stream.moviePlaylist(titleId, user?.sub);
  }

  /**
   * Seek thumbnail (WebVTT) — player-ийн seek preview.
   * ⚠️ `text/vtt` content-type ЗААВАЛ — эс бөгөөс browser нь track
   * элементийг танихгүй, preview огт гарахгүй.
   */
  @Get('movie/:titleId/thumbnails.vtt')
  @Header('Content-Type', 'text/vtt')
  @Header('Cache-Control', 'private, max-age=300')
  movieThumbs(@Param('titleId') titleId: string, @CurrentUser() user: JwtPayload | null) {
    return this.stream.movieThumbnails(titleId, user?.sub);
  }

  @Get('episode/:episodeId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  episode(@Param('episodeId') episodeId: string, @CurrentUser() user: JwtPayload | null) {
    return this.stream.episodePlaylist(episodeId, user?.sub);
  }

  @Get('trailer/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=300')
  trailer(@Param('titleId') titleId: string) {
    return this.stream.trailerPlaylist(titleId);
  }

  /* ─── ABR дэд playlist (v0/v1/v2) ────────────────────────────────────────
   * ⚠️ Master playlist доторх мөрүүд ЭДГЭЭР рүү заана. Ингэснээр player
   * чанар солих бүрт эрхийн шалгалтаас дахин өнгөрнө — зөвхөн segment нь
   * R2-оос шууд урсана (bandwidth backend-ээр дамжихгүй).
   * `?v=` нь `vN.m3u8` хэлбэртэй эсэхийг service шалгана (зам гарахаас).
   * ─────────────────────────────────────────────────────────────────────── */

  @Get('movie/:titleId/variant.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  movieVariant(
    @Param('titleId') titleId: string,
    @Query('v') v: string,
    @CurrentUser() user: JwtPayload | null,
  ) {
    return this.stream.movieVariant(titleId, v, user?.sub);
  }

  @Get('episode/:episodeId/variant.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=120')
  episodeVariant(
    @Param('episodeId') episodeId: string,
    @Query('v') v: string,
    @CurrentUser() user: JwtPayload | null,
  ) {
    return this.stream.episodeVariant(episodeId, v, user?.sub);
  }

  @Get('trailer/:titleId/variant.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, max-age=300')
  trailerVariant(@Param('titleId') titleId: string, @Query('v') v: string) {
    return this.stream.trailerVariant(titleId, v);
  }
}
