import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CloudflareStreamService } from './cloudflare-stream.service';
import { VideoHlsService } from './video-hls.service';

@Global()
@Module({
  providers: [StorageService, CloudflareStreamService, VideoHlsService],
  exports: [StorageService, CloudflareStreamService, VideoHlsService],
})
export class StorageModule {}
