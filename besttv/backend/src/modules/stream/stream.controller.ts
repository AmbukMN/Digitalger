import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { StreamService } from './stream.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

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
