import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StreamService } from './stream.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * АДМИН PREVIEW — байршуулсан видеогоо шалгах.
 *
 * ⚠️ Тусдаа controller: нийтийн /stream нь OptionalJwtAuthGuard-тай тул
 * түүн дотор ADMIN-only маршрут тавьбал guard зөрчилдөнө.
 */
@Controller('admin/stream')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminStreamController {
  constructor(private readonly stream: StreamService) {}

  @Get('movie/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, no-store')
  movie(@Param('titleId') titleId: string) {
    return this.stream.adminPreview('movie', titleId);
  }

  @Get('episode/:episodeId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, no-store')
  episode(@Param('episodeId') episodeId: string) {
    return this.stream.adminPreview('episode', episodeId);
  }

  @Get('trailer/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, no-store')
  trailer(@Param('titleId') titleId: string) {
    return this.stream.adminPreview('trailer', titleId);
  }
}

// ⚠️ OptionalJwtAuthGuard — үнэгүй контентыг нэвтрээгүй хүн ч үзнэ.
// Premium эрх шалгалт service дотор (assertAccess).
@Controller('stream')
@UseGuards(OptionalJwtAuthGuard)
export class StreamController {
  constructor(private readonly stream: StreamService) {}

  @Get('movie/:titleId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, no-store')
  movie(@Param('titleId') titleId: string, @CurrentUser() user: JwtPayload | null) {
    return this.stream.moviePlaylist(titleId, user?.sub);
  }

  @Get('episode/:episodeId/playlist.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, no-store')
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
  @Header('Cache-Control', 'private, no-store')
  movieVariant(
    @Param('titleId') titleId: string,
    @Query('v') v: string,
    @CurrentUser() user: JwtPayload | null,
  ) {
    return this.stream.movieVariant(titleId, v, user?.sub);
  }

  @Get('episode/:episodeId/variant.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'private, no-store')
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
