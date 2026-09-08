import { Module } from '@nestjs/common';
import { TitlesController } from './titles.controller';
import { TitlesService } from './titles.service';
import { TitlesAdminController } from './titles-admin.controller';
import { TitlesAdminService } from './titles-admin.service';
import { TitleMediaHelper } from './title-media.helper';
import { ChatModule } from '../chat/chat.module';

// SubscriptionsModule нь @Global() тул import шаардлагагүй
@Module({
  /**
   * ⚠️⚠️ `ChatModule` — админаас тохируулсан чатботын түлхүүр үг.
   *
   * `search()` нь «99» → «Өнчин охин» дүрмийг шалгадаг тул
   * `ChatKeywordsService` хэрэгтэй.
   *
   * ⚠️ `forwardRef` ХЭРЭГГҮЙ: ChatModule нь TitlesModule-ыг
   * импортлодоггүй (тойрог хамаарал байхгүй).
   */
  imports: [ChatModule],
  controllers: [TitlesController, TitlesAdminController],
  providers: [TitlesService, TitlesAdminService, TitleMediaHelper],
  /* ⚠️ `TitlesService` — гар утасны модул (`MobileModule`) нь хайлт,
     дэлгэрэнгүйг ДАХИН ашиглана. Код давхардуулахгүйн тулд экспортлов;
     вэбийн зан төлөв ХӨНДӨГДӨӨГҮЙ (зөвхөн нэмэлт). */
  exports: [TitleMediaHelper, TitlesService],
})
export class TitlesModule {}
