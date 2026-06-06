import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DownloadsController } from './downloads.controller';
import { PublicDownloadsController } from './public-downloads.controller';
import { DownloadsService } from './downloads.service';
import { ZIP_QUEUE } from './zip.processor';
import { ZipCleanupService } from './zip-cleanup.service';
import { StorageModule } from '../../storage/storage.module';

// ScheduleModule.forRoot() нь app.module-д нэг удаа — энд хасав (cron давхардлаас сэргийлэв).
//
// ⚠️ ZipProcessor-ийг ЭНД бүртгэхгүй — энэ нь зөвхөн worker container-д
// (worker.module, replicas:2) ажиллана. API container нь зөвхөн PRODUCER
// (DownloadsService.zipQueue.add — job-д нэмдэг). Хоёр газар бүртгэвэл нэг ZIP
// job-ийг API + 2 worker = 3 consumer зэрэг авч R2-руу давхар upload хийдэг.
// registerQueue нь producer-т хангалттай.
@Module({
  imports: [
    StorageModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl') ?? 'redis://localhost:6379',
      }),
    }),
    BullModule.registerQueue({ name: ZIP_QUEUE }),
  ],
  controllers: [DownloadsController, PublicDownloadsController],
  providers: [DownloadsService, ZipCleanupService],
})
export class DownloadsModule {}
