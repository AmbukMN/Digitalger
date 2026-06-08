import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SeoService, UpsertSeoDto } from './seo.service';

// Public — frontend generateMetadata уншина. Override олдохгүй бол null.
@Controller('seo')
export class SeoPublicController {
  constructor(private readonly service: SeoService) {}

  // GET /seo/override?path=/products
  @Get('override')
  getByPath(@Query('path') path: string) {
    return this.service.getByPath(path);
  }
}

// Admin — RolesGuard @Roles(ADMIN)
@Controller('admin/seo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SeoAdminController {
  constructor(private readonly service: SeoService) {}

  @Get()
  listAll() {
    return this.service.listAll();
  }

  // Бодит route жагсаалт (admin dropdown) — динамик, бүлэглэсэн, label-тай
  @Get('allowed-paths')
  getAllowedPaths() {
    return this.service.getAllowedPaths();
  }

  @Post()
  create(@Body() dto: UpsertSeoDto) {
    return this.service.upsert(dto);
  }

  @Put()
  upsert(@Body() dto: UpsertSeoDto) {
    return this.service.upsert(dto);
  }

  // Устгах → default-руу буцна
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
