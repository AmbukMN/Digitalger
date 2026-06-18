import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { ZipProcessor, ZIP_QUEUE } from './modules/downloads/zip.processor';
import { EmailService } from './modules/notifications/email.service';
import { EmailQueueService } from './modules/notifications/email-queue.service';
import { EmailProcessor } from './modules/notifications/email.processor';
import { EMAIL_QUEUE, EMAIL_RATE_LIMIT } from './modules/notifications/email-queue.types';
import { VIDEO_QUEUE } from './modules/videos/video-queue.types';
import { VideoProcessor } from './modules/videos/video.processor';

// ⚠️ Worker container — ZIP болон EMAIL queue-ийн CONSUMER (processor) энд ажиллана.
// API container нь зөвхөн producer (job нэмэх). Processor-ийг ЗӨВХӨН энд бүртгэнэ.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    StorageModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl') ?? 'redis://localhost:6379',
      }),
    }),
    BullModule.registerQueue({ name: ZIP_QUEUE }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      // ⚠️ SES 14/сек limit-ийг ЗӨРЧИХГҮЙ — max 10/сек.
      limiter: { max: EMAIL_RATE_LIMIT.max, duration: EMAIL_RATE_LIMIT.duration },
    }),
    BullModule.registerQueue({ name: VIDEO_QUEUE }),
  ],
  providers: [
    ZipProcessor,
    // EmailProcessor нь EmailService.sendRaw (suppression/EmailLog/SES retry) +
    // EmailQueueService (campaign прогресс) дуудна.
    EmailService,
    EmailQueueService,
    EmailProcessor,
    // VideoProcessor — R2 HLS хөрвүүлэлт (ffmpeg). StorageModule(Global)-аас
    // StorageService + VideoHlsService inject хийнэ.
    VideoProcessor,
  ],
})
export class WorkerModule {}
