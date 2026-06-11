import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';

@Controller('menu')
export class MenuPublicController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  list() {
    return this.menu.findPublic();
  }
}

@Controller('admin/menu')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MenuAdminController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  listAll(@CurrentUser() me: JwtPayload) {
    return this.menu.findAll(me);
  }

  @Post()
  create(@Body() dto: CreateMenuItemDto, @CurrentUser() me: JwtPayload) {
    return this.menu.create(dto, me);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto, @CurrentUser() me: JwtPayload) {
    return this.menu.update(id, dto, me);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.menu.remove(id, me);
  }

  @Put('reorder')
  reorder(@Body('ids') ids: string[], @CurrentUser() me: JwtPayload) {
    return this.menu.reorder(ids, me);
  }
}
