import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Controller('banners')
export class BannersPublicController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  list() {
    return this.banners.findActive();
  }
}

@Controller('admin/banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BannersAdminController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  listAll(@CurrentUser() me: JwtPayload) {
    return this.banners.findAll(me);
  }

  @Post()
  create(@Body() dto: CreateBannerDto, @CurrentUser() me: JwtPayload) {
    return this.banners.create(dto, me);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto, @CurrentUser() me: JwtPayload) {
    return this.banners.update(id, dto, me);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.banners.remove(id, me);
  }
}
