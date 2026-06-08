import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { N8nModule } from '../n8n/n8n.module';
import { BackupService } from './backup.service';
import { MonitorService } from './monitor.service';
import { StreamCleanupService } from './stream-cleanup.service';

// ⚠️ ScheduleModule.forRoot() нь app.module-д НЭГ удаа. Энд БҮҮ нэм.
// @Cron decorator л ашиглана (давхар бүртгэлээс сэргийлэв).
// StorageService нь @Global StorageModule-аас ирнэ — энд import шаардлагагүй.
@Module({
  imports: [PrismaModule, N8nModule],
  providers: [BackupService, MonitorService, StreamCleanupService],
})
export class BackupModule {}
