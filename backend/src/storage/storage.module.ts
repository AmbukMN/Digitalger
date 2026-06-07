import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CloudflareStreamService } from './cloudflare-stream.service';

@Global()
@Module({
  providers: [StorageService, CloudflareStreamService],
  exports: [StorageService, CloudflareStreamService],
})
export class StorageModule {}
