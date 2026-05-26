import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { N8nService } from './n8n.service';
import { DailyReportService } from './daily-report.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [N8nService, DailyReportService],
  exports: [N8nService],
})
export class N8nModule {}
