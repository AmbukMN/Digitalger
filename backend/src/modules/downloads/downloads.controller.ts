import { Controller, Get, GoneException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DownloadsService } from './downloads.service';

@Controller('downloads')
@UseGuards(JwtAuthGuard)
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get()
  history(@CurrentUser('sub') userId: string) {
    return this.downloadsService.listUserDownloads(userId);
  }

  // ── Async queue-based zip ────────────────────────────────────────────────

  @Post('async-zip/:productId')
  enqueueProductZip(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.downloadsService.enqueueProductZip(userId, productId);
  }

  @Post('async-zip/:productId/bundle/:bundleId')
  enqueueBundleZip(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
    @Param('bundleId') bundleId: string,
  ) {
    return this.downloadsService.enqueueBundleZip(userId, productId, bundleId);
  }

  @Get('async-zip/status/:jobId')
  getZipStatus(
    @CurrentUser('sub') userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.downloadsService.getZipJobStatus(userId, jobId);
  }

  // ── Deprecated sync streaming — 410 Gone буцаана ────────────────────────
  // Том файлд сервер унадаг байсан тул async-zip ашиглана

  @Post('zip/:productId')
  deprecatedZip() {
    throw new GoneException('Use POST /downloads/async-zip/:productId instead');
  }

  @Post('zip/:productId/bundle/:bundleId')
  deprecatedBundleZip() {
    throw new GoneException('Use POST /downloads/async-zip/:productId/bundle/:bundleId instead');
  }

  // ── Product/bundle download file (admin-uploaded, direct presign) ────────

  @Post('product/:productId/download-file')
  getProductDownloadFile(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.downloadsService.getProductDownloadFileUrl(userId, productId);
  }

  @Post('bundle/:bundleId/download-file')
  getBundleDownloadFile(
    @CurrentUser('sub') userId: string,
    @Param('bundleId') bundleId: string,
  ) {
    return this.downloadsService.getBundleDownloadFileUrl(userId, bundleId);
  }

  // ── Single file signed URL ───────────────────────────────────────────────

  @Post(':fileId')
  getSignedUrl(
    @CurrentUser('sub') userId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.downloadsService.verifyAndGetSignedUrl(userId, fileId);
  }
}
