import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailQueueService } from './email-queue.service';
import { ReputationService } from './reputation.service';
import { N8nModule } from '../n8n/n8n.module';
import { EMAIL_QUEUE, EMAIL_RATE_LIMIT } from './email-queue.types';

// ⚠️ ScheduleModule.forRoot() нь app.module-д нэг удаа — энд хасав (Reputation cron
// давхар бүртгэгдэхээс сэргийлэв).
//
// ⚠️ EmailProcessor-ийг ЭНД бүртгэхгүй — энэ нь зөвхөн worker container-д
// (worker.module) ажиллана. API container нь зөвхөн PRODUCER (EmailQueueService).
// Хоёр газар бүртгэвэл нэг имэйл job-ийг давхар илгээнэ. registerQueue нь
// producer-т хангалттай (limiter тохиргоо энд тавьсан ч worker дахь registration-д
// мөн тавина — Bull нь queue option-ийг consumer талаас мөрддөг).
@Module({
  imports: [
    N8nModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl') ?? 'redis://localhost:6379',
      }),
    }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      // ⚠️ SES 14/сек limit-ийг ЗӨРЧИХГҮЙ — max 10/сек (найдвартай зай).
      limiter: { max: EMAIL_RATE_LIMIT.max, duration: EMAIL_RATE_LIMIT.duration },
    }),
  ],
  providers: [EmailService, EmailQueueService, ReputationService],
  exports: [EmailService, EmailQueueService, ReputationService],
})
export class NotificationsModule {}
