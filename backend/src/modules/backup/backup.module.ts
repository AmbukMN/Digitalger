import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { N8nModule } from '../n8n/n8n.module';
import { BackupService } from './backup.service';
import { MonitorService } from './monitor.service';
import { StreamCleanupService } from './stream-cleanup.service';
// ⛔ R2CleanupService-ийг ЗОРИУД ИДЭВХГҮЙ БОЛГОВ (2026-06-15).
// Энэ cron нь URL хэлбэрийн зургийг "orphan" гэж андуурч 93 зураг (≈558MB)
// устгасан. Логик зөв санаатай ч эрсдэл өндөр тул бүрэн зогсоов — provider-аас
// хассан учир @Cron бүртгэгдэхгүй, ХЭЗЭЭ Ч ажиллахгүй. Дахин асаах бол маш
// найдвартай тест (URL+key хоёр хэлбэр, бүх хүснэгт) + R2 versioning/soft-delete
// шаардана. Файл өөрөө хэвээр (түүх), зөвхөн бүртгэлээс хассан.
// import { R2CleanupService } from './r2-cleanup.service';

// ⚠️ ScheduleModule.forRoot() нь app.module-д НЭГ удаа. Энд БҮҮ нэм.
// @Cron decorator л ашиглана (давхар бүртгэлээс сэргийлэв).
// StorageService нь @Global StorageModule-аас ирнэ — энд import шаардлагагүй.
@Module({
  imports: [PrismaModule, N8nModule],
  providers: [BackupService, MonitorService, StreamCleanupService],
})
export class BackupModule {}
