import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersAdminController, PartnersPublicController } from './partners.controller';

@Module({
  controllers: [PartnersPublicController, PartnersAdminController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
