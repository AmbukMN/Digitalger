import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  BundlesService,
  CreateBundleDto,
  CreateBundleItemDto,
  UpdateBundleDto,
  UpdateBundleItemDto,
} from './bundles.service';

// Public: get bundles for product detail page
@Controller('products/:productId/bundles')
export class BundlesPublicController {
  constructor(private readonly svc: BundlesService) {}

  @Get()
  list(@Param('productId') productId: string) {
    return this.svc.findByProduct(productId);
  }
}

// Admin: manage bundles per product
@Controller('admin/products/:productId/bundles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BundlesAdminController {
  constructor(private readonly svc: BundlesService) {}

  @Get()
  list(@Param('productId') productId: string) {
    return this.svc.findByProduct(productId);
  }

  @Post()
  create(@Param('productId') productId: string, @Body() dto: CreateBundleDto) {
    return this.svc.createBundle(productId, dto);
  }

  @Patch(':bundleId')
  updateBundle(@Param('bundleId') bundleId: string, @Body() dto: UpdateBundleDto) {
    return this.svc.updateBundle(bundleId, dto);
  }

  @Delete(':bundleId')
  removeBundle(@Param('bundleId') bundleId: string) {
    return this.svc.removeBundle(bundleId);
  }

  @Post(':bundleId/items')
  createItem(@Param('bundleId') bundleId: string, @Body() dto: CreateBundleItemDto) {
    return this.svc.createItem(bundleId, dto);
  }

  @Patch(':bundleId/items/:itemId')
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateBundleItemDto) {
    return this.svc.updateItem(itemId, dto);
  }

  @Delete(':bundleId/items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.svc.removeItem(itemId);
  }
}
