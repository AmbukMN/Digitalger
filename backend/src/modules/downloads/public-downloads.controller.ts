import { Controller, Get, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DownloadsService } from './downloads.service';

/**
 * ҮНЭГҮЙ бүтээгдэхүүний нийтийн (auth-гүй) download endpoint-ууд.
 *
 * price = 0 (эсвэл null) бүтээгдэхүүнийг хэн ч — нэвтрээгүй ч — шууд татна.
 * Бүх метод downloads.service дотор assertFree-ээр price=0 эсэхийг шалгадаг
 * тул ҮНЭТЭЙ бүтээгдэхүүн энэ замаар ХЭЗЭЭ Ч татагдахгүй (Forbidden буцаана).
 *
 * Зам: /downloads/free/...  (JwtAuthGuard-гүй — нийтэд нээлттэй)
 */
@Controller('downloads/free')
export class PublicDownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  /** Ганц файл татах (үнэгүй product-ийн) */
  @Post(':productId/file/:fileId')
  @SkipThrottle()
  freeFile(
    @Param('productId') productId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.downloadsService.freeFileUrl(productId, fileId);
  }

  /** Бэлэн zip (downloadFileKey) шууд татах */
  @Post(':productId/download-file')
  @SkipThrottle()
  freeDownloadFile(@Param('productId') productId: string) {
    return this.downloadsService.freeProductDownloadFileUrl(productId);
  }

  /** Бүх файлыг zip болгох queue */
  @Post(':productId/zip')
  @SkipThrottle()
  freeZip(@Param('productId') productId: string) {
    return this.downloadsService.enqueueFreeProductZip(productId);
  }

  /** Zip job-ийн статус */
  @Get('zip/status/:jobId')
  @SkipThrottle()
  freeZipStatus(@Param('jobId') jobId: string) {
    return this.downloadsService.getFreeZipJobStatus(jobId);
  }
}
