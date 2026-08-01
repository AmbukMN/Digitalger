import { Module } from '@nestjs/common';
import { AdminStreamController, StreamController } from './stream.controller';
import { StreamService } from './stream.service';

@Module({
  // ⚠️ AdminStreamController — админ өөрийн байршуулсан видеог шалгах preview
  controllers: [StreamController, AdminStreamController],
  providers: [StreamService],
})
export class StreamModule {}
