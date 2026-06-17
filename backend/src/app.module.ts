import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppCacheModule } from './common/cache/app-cache.module';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DownloadsModule } from './modules/downloads/downloads.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AdminModule } from './modules/admin/admin.module';
import { CoursesModule } from './modules/courses/courses.module';
import { BannersModule } from './modules/banners/banners.module';
import { MenuModule } from './modules/menu/menu.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { HelpVideosModule } from './modules/help-videos/help-videos.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { BundlesModule } from './modules/bundles/bundles.module';
import { BlogModule } from './modules/blog/blog.module';
import { PagesModule } from './modules/pages/pages.module';
import { SeoModule } from './modules/seo/seo.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationCenterModule } from './modules/notification-center/notification-center.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { SubscribersModule } from './modules/subscribers/subscribers.module';
import { ContactModule } from './modules/contact/contact.module';
import { EmailEventsModule } from './modules/email-events/email-events.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { BackupModule } from './modules/backup/backup.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // ⚠️ ScheduleModule.forRoot() ЗӨВХӨН ЭНД (нэг удаа). Олон module-д давхар
    // forRoot() дуудвал cron job бүр N удаа бүртгэгдэж N удаа зэрэг ажилладаг
    // (payment reconcile 5 удаа confirm хийж Telegram/email 5 удаа явсан алдаа).
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('redisUrl');
        try {
          const store = await redisStore({ url: redisUrl });
          return { store, ttl: 60_000 };
        } catch {
          return { ttl: 60_000 };
        }
      },
    }),
    AppCacheModule,
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    PaymentsModule,
    DownloadsModule,
    UploadsModule,
    AdminModule,
    CoursesModule,
    BannersModule,
    MenuModule,
    WishlistModule,
    FaqsModule,
    HelpVideosModule,
    TestimonialsModule,
    BundlesModule,
    BlogModule,
    PagesModule,
    SeoModule,
    CouponsModule,
    NotificationsModule,
    NotificationCenterModule,
    AnalyticsModule,
    AiModule,
    TransferModule,
    SubscribersModule,
    ContactModule,
    EmailEventsModule,
    MarketingModule,
    BackupModule,
    ChatModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
