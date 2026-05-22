import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
import { ZipProcessor, ZIP_QUEUE } from './zip.processor';
import { StorageModule } from '../../storage/storage.module';

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
  controllers: [DownloadsController],
  providers: [DownloadsService, ZipProcessor],
})
export class DownloadsModule {}
