import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { N8nModule } from './modules/n8n/n8n.module';
import { StorageModule } from './storage/storage.module';
import { VideoProcessor } from './modules/videos/video.processor';
import { VIDEO_QUEUE } from './modules/videos/video-queue.types';
import { CrosspostProcessor } from './modules/crosspost/crosspost.processor';
import { CrosspostService } from './modules/crosspost/crosspost.service';
import { MetaGraphService } from './modules/crosspost/meta-graph.service';
import { CROSSPOST_QUEUE } from './modules/crosspost/crosspost-queue.types';

/** Worker — HLS хөрвүүлэлт + Instagram хөндлөн нийтлэлийн consumer */
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
    /* ⚠️ Instagram нийтлэл — ЗӨВХӨН энд (API-д ч бүртгэвэл нэг пост
       ХОЁР УДАА нийтлэгдэнэ) */
    BullModule.registerQueue({ name: CROSSPOST_QUEUE }),
    PrismaModule,
    StorageModule,
    /* ⚠️ HLS хөрвүүлэлт унахад Telegram мэдэгдэл илгээхэд
       (`video.processor.ts`). Энэ модульгүй бол `emitVideoFailed`
       дуудагдах боломжгүй — хөрвүүлэлт унасныг хэн ч мэдэхгүй байв. */
    N8nModule,
  ],
  providers: [VideoProcessor, CrosspostProcessor, CrosspostService, MetaGraphService],
})
export class WorkerModule {}
