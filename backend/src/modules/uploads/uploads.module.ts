import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { ImageProcessorService } from '../../storage/image-processor.service';

@Module({
  controllers: [UploadsController],
  providers: [ImageProcessorService],
  exports: [ImageProcessorService],
})
export class UploadsModule {}
