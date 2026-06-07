import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketingService } from './marketing.service';

// ⚠️ ScheduleModule.forRoot() ЭНД БҮҮ нэм — зөвхөн app.module-д (давхар forRoot
// дуудвал cron job олон удаа бүртгэгдэнэ). Энэ module зөвхөн @Cron ашиглана.
@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
