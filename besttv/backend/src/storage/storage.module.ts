import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ImageProcessorService } from './image-processor.service';
import { VideoHlsService } from './video-hls.service';

@Global()
@Module({
  providers: [StorageService, ImageProcessorService, VideoHlsService],
  exports: [StorageService, ImageProcessorService, VideoHlsService],
})
export class StorageModule {}
