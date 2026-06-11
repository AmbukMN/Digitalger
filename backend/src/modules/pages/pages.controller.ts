import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PagesService, UpsertPageDto } from './pages.service';

@Controller('pages')
export class PagesPublicController {
  constructor(private readonly service: PagesService) {}

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}

@Controller('admin/pages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PagesAdminController {
  constructor(private readonly service: PagesService) {}

  @Put(':slug')
  upsert(@Param('slug') slug: string, @Body() dto: UpsertPageDto, @CurrentUser() me: JwtPayload) {
    return this.service.upsert(slug, dto, me.sub);
  }
}
