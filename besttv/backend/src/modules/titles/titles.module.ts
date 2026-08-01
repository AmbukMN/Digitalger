import { Module } from '@nestjs/common';
import { TitlesController } from './titles.controller';
import { TitlesService } from './titles.service';
import { TitlesAdminController } from './titles-admin.controller';
import { TitlesAdminService } from './titles-admin.service';
import { TitleMediaHelper } from './title-media.helper';

// SubscriptionsModule нь @Global() тул import шаардлагагүй
@Module({
  controllers: [TitlesController, TitlesAdminController],
  providers: [TitlesService, TitlesAdminService, TitleMediaHelper],
  exports: [TitleMediaHelper],
})
export class TitlesModule {}
