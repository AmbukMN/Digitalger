import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  // ── Async queue-based zip (production) ──────────────────────────────────

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

  // ── Legacy streaming (fallback жижиг файлд) ─────────────────────────────

  @Post('zip/:productId')
  downloadZip(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
    @Res() res: Response,
  ) {
    return this.downloadsService.streamZipDownload(userId, productId, res);
  }

  @Post('zip/:productId/bundle/:bundleId')
  downloadBundleZip(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
    @Param('bundleId') bundleId: string,
    @Res() res: Response,
  ) {
    return this.downloadsService.streamBundleZip(userId, productId, bundleId, res);
  }

  @Post(':fileId')
  getSignedUrl(
    @CurrentUser('sub') userId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.downloadsService.verifyAndGetSignedUrl(userId, fileId);
  }
}
