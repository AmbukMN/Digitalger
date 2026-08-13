import { Global, Module } from '@nestjs/common';
import { N8nService } from './n8n.service';
import { DailyReportService } from './daily-report.service';

/**
 * ⚠️ `@Global` — мэдэгдэл нь ОЛОН модулиас дуудагдана (payments,
 * videos, backup). Модуль бүрд import хийхийг шаардвал шинэ газарт
 * мэдэгдэл нэмэхэд мартагдана.
 */
@Global()
@Module({
  providers: [N8nService, DailyReportService],
  exports: [N8nService],
})
export class N8nModule {}
