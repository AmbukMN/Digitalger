import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

// Global — stream gate, titles зэрэг олон модуль эрх шалгадаг
@Global()
@Module({
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
