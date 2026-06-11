import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CouponsService } from './coupons.service';

// ── Public validate endpoint ──────────────────────────────────────────────────
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate')
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // купон код brute force-аас сэргийлэх
  @UseGuards(OptionalJwtAuthGuard)
  validate(
    @Body() body: { code: string; price: number; productIds?: string[] },
    @CurrentUser('sub') userId?: string,
  ) {
    return this.coupons.validate(body.code, body.price ?? 0, userId, body.productIds);
  }
}

// ── Admin CRUD endpoints ──────────────────────────────────────────────────────
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  findAll(@CurrentUser() me: JwtPayload) {
    return this.coupons.findAll(me);
  }

  @Get('generate-code')
  generateCode(@Query('length') length?: string) {
    return { code: this.coupons.generateCode(length ? parseInt(length) : 12) };
  }

  @Post()
  create(
    @Body()
    body: {
      code?: string;
      type: 'PERCENT' | 'FIXED';
      value: number;
      minPrice?: number;
      maxUses?: number;
      active?: boolean;
      expiresAt?: string | null;
    },
    @CurrentUser('sub') userId: string,
  ) {
    return this.coupons.create(body, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      code: string;
      type: 'PERCENT' | 'FIXED';
      value: number;
      minPrice: number | null;
      maxUses: number | null;
      active: boolean;
      expiresAt: string | null;
    }>,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.coupons.update(id, body, me);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.coupons.remove(id, me);
  }
}
