import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
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
}
