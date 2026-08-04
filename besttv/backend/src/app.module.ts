import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { CfThrottlerGuard } from './common/cf-throttler.guard';
import { BullModule } from '@nestjs/bull';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { TitlesModule } from './modules/titles/titles.module';
import { GenresModule } from './modules/genres/genres.module';
import { LibraryModule } from './modules/library/library.module';
import { StreamModule } from './modules/stream/stream.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { PlansModule } from './modules/plans/plans.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TmdbModule } from './modules/tmdb/tmdb.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { SeoModule } from './modules/seo/seo.module';
import { FaqModule } from './modules/faq/faq.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { BlogModule } from './modules/blog/blog.module';
import { PagesModule } from './modules/pages/pages.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ChatModule } from './modules/chat/chat.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { EmailModule } from './modules/email/email.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    /**
     * ⚠️ ДАВХАРЛАСАН хязгаар — нэг л хязгаар хангалтгүй:
     *   short  — гэнэтийн үер (secondly burst)
     *   medium — минутын хэвийн урсгал
     *   long   — удаан үргэлжлэх scraping/spam
     * Аль нэгийг давбал 429 буцна.
     */
    ThrottlerModule.forRoot([
      /**
       * ⚠️⚠️ `default` нэр ЗААВАЛ ЭХЭНД байна.
       *
       * Кодын 25 газарт `@Throttle({ default: {...} })` бичигдсэн (нэвтрэлт,
       * төлбөр, имэйл, купон, түрээс). Гэтэл энд зөвхөн short/medium/long
       * нэртэй тохиргоо байсан тул `default` нэр ОЛДОХГҮЙ → тэдгээр
       * хязгаарууд ЧИМЭЭГҮЙ АЛГАСАГДАЖ, огт хэрэгжихгүй байв
       * (тест: купоны endpoint-д 20 хүсэлт зэрэг явахад бүгд 200 буцсан).
       *
       * `@Throttle`-гүй endpoint-д short/medium/long хэвээр үйлчилнэ.
       */
      { name: 'default', ttl: 60_000, limit: 300 },
      { name: 'short', ttl: 1_000, limit: 20 },
      { name: 'medium', ttl: 60_000, limit: 300 },
      { name: 'long', ttl: 3_600_000, limit: 3_000 },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('redisUrl'),
        prefix: 'besttv', // queue key namespace
      }),
    }),
    PrismaModule,
    StorageModule,
    SubscriptionsModule,
    AuthModule,
    TitlesModule,
    GenresModule,
    LibraryModule,
    StreamModule,
    UploadsModule,
    PlansModule,
    PaymentsModule,
    TmdbModule,
    ReviewsModule,
    UsersModule,
    AnalyticsModule,
    HealthModule,
    SeoModule,
    FaqModule,
    CouponsModule,
    BlogModule,
    PagesModule,
    WalletModule,
    TrackingModule,
    ChatModule,
    SettingsModule,
    RentalsModule,
    EmailModule,
    NotificationsModule,
  ],
  // ⚠️ CfThrottlerGuard — Cloudflare-ийн ард ЖИНХЭНЭ IP-ээр хязгаарлана
  providers: [{ provide: APP_GUARD, useClass: CfThrottlerGuard }],
})
export class AppModule {}
