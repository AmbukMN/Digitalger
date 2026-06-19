import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreatePartnerDto, PartnersService, UpdatePartnerDto } from './partners.service';

// Public: идэвхтэй хамтрагчид (footer swiper)
@Controller('partners')
export class PartnersPublicController {
  constructor(private readonly svc: PartnersService) {}

  @Get()
  list() {
    return this.svc.findAllActive();
  }
}

// Admin CRUD
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PartnersAdminController {
  constructor(private readonly svc: PartnersService) {}

  @Get()
  list(@CurrentUser() me: JwtPayload) {
    return this.svc.findAll(me);
  }

  @Post()
  create(@Body() dto: CreatePartnerDto, @CurrentUser() me: JwtPayload) {
    return this.svc.create(dto, me);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.svc.update(id, dto, me);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.svc.remove(id, me);
  }
}
