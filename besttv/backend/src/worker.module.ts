import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { VideoProcessor } from './modules/videos/video.processor';
import { VIDEO_QUEUE } from './modules/videos/video-queue.types';

/** Worker — зөвхөн HLS хөрвүүлэлтийн consumer (API endpoint байхгүй) */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl'),
        prefix: 'besttv',
      }),
    }),
    BullModule.registerQueue({ name: VIDEO_QUEUE }),
    PrismaModule,
    StorageModule,
  ],
  providers: [VideoProcessor],
})
export class WorkerModule {}
