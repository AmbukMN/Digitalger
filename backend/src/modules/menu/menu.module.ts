import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuAdminController, MenuPublicController } from './menu.controller';

@Module({
  controllers: [MenuPublicController, MenuAdminController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
