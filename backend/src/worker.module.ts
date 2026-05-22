import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { ZipProcessor, ZIP_QUEUE } from './modules/downloads/zip.processor';

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
  ],
  providers: [ZipProcessor],
})
export class WorkerModule {}
