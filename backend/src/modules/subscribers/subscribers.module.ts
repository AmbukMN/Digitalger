import { Module } from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import {
  SubscribersPublicController,
  AdminSubscribersController,
} from './subscribers.controller';

@Module({
  controllers: [SubscribersPublicController, AdminSubscribersController],
  providers: [SubscribersService],
  exports: [SubscribersService],
})
export class SubscribersModule {}
