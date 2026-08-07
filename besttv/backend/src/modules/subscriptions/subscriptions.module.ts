import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { ExpiryNotifyService } from './expiry-notify.service';

// Global — stream gate, titles зэрэг олон модуль эрх шалгадаг
@Global()
@Module({
  /**
   * ⚠️ `ExpiryNotifyService` нь cron — экспортлох шаардлагагүй, зөвхөн
   * бүртгэгдсэн байхад л `@Cron` идэвхжинэ.
   * ⚠️ Энэ нь ЗӨВХӨН имэйл илгээнэ, эрх хаахгүй (эрх нь query бүрт
   * `expiresAt > now()`-ээр шалгагддаг тул cron унасан ч эвдрэхгүй).
   */
  providers: [SubscriptionsService, ExpiryNotifyService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
