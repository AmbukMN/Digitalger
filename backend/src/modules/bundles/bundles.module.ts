import { Module } from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { BundlesAdminController, BundlesPublicController } from './bundles.controller';

@Module({
  controllers: [BundlesPublicController, BundlesAdminController],
  providers: [BundlesService],
  exports: [BundlesService],
})
export class BundlesModule {}
