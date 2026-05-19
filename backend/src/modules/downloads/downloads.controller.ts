import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Post(':fileId')
  getSignedUrl(
    @CurrentUser('sub') userId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.downloadsService.verifyAndGetSignedUrl(userId, fileId);
  }
}
