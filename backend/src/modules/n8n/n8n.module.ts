import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { N8nService } from './n8n.service';
import { DailyReportService } from './daily-report.service';

// ScheduleModule.forRoot() нь app.module-д нэг удаа — энд хасав (DailyReport
// cron давхар ажиллаж өдрийн тайлан давтахаас сэргийлэв).
@Module({
  imports: [PrismaModule],
  providers: [N8nService, DailyReportService],
  exports: [N8nService],
})
export class N8nModule {}
