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
  listAll() {
    return this.menu.findAll();
  }

  @Post()
  create(@Body() dto: CreateMenuItemDto) {
    return this.menu.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menu.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menu.remove(id);
  }

  @Put('reorder')
  reorder(@Body('ids') ids: string[]) {
    return this.menu.reorder(ids);
  }
}
