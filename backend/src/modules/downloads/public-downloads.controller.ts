import { Controller, Get, Headers, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DownloadsService } from './downloads.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * ҮНЭГҮЙ бүтээгдэхүүний нийтийн (auth-гүй) download endpoint-ууд.
 *
 * price = 0 (эсвэл null) бүтээгдэхүүнийг хэн ч — нэвтрээгүй ч — шууд татна.
 * Бүх метод downloads.service дотор assertFree-ээр price=0 эсэхийг шалгадаг
 * тул ҮНЭТЭЙ бүтээгдэхүүн энэ замаар ХЭЗЭЭ Ч татагдахгүй (Forbidden буцаана).
 *
 * Зам: /downloads/free/...  (JwtAuthGuard-гүй — нийтэд нээлттэй)
 *
 * Throttle тавьсан (@SkipThrottle байсныг арилгав) — free-zip нь Bull job
 * үүсгэдэг тул queue спамаас сэргийлнэ. status polling-д өндөр limit.
 */
@Throttle({ default: { limit: 60, ttl: 60000 } })
@Controller('downloads/free')
export class PublicDownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  /** Ганц файл татах (үнэгүй product-ийн). @Ip — татах тоолуурын dedup-д ашиглана.
   *  OptionalJwtAuthGuard — нэвтэрсэн бол userId гаргаж "Татсан" түүхэд бүртгэнэ. */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':productId/file/:fileId')
  freeFile(
    @Param('productId') productId: string,
    @Param('fileId') fileId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.downloadsService.freeFileUrl(productId, fileId, ip, { userId: user?.sub ?? null, ip, userAgent });
  }

  /** Бэлэн zip (downloadFileKey) шууд татах */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':productId/download-file')
  freeDownloadFile(
    @Param('productId') productId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.downloadsService.freeProductDownloadFileUrl(productId, ip, { userId: user?.sub ?? null, ip, userAgent });
  }

  /** Бүх файлыг zip болгох queue — job үүсгэдэг тул бага limit */
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(':productId/zip')
  freeZip(
    @Param('productId') productId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.downloadsService.enqueueFreeProductZip(productId, ip, { userId: user?.sub ?? null, ip, userAgent });
  }

  /** Zip job-ийн статус — polling тул өндөр limit */
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  @Get('zip/status/:jobId')
  freeZipStatus(@Param('jobId') jobId: string) {
    return this.downloadsService.getFreeZipJobStatus(jobId);
  }
}
