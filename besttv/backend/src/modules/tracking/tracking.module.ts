import { Global, Module } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TrackingService, type TrackContext } from './tracking.service';

class PageViewDto {
  @IsString()
  @MaxLength(500)
  path: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;
}

class TitleEventDto {
  @IsString()
  @MaxLength(40)
  type: string;

  @IsString()
  @MaxLength(60)
  titleId: string;

  @IsOptional() @IsString() @MaxLength(200) titleSlug?: string;
  @IsOptional() @IsString() @MaxLength(300) titleName?: string;
  @IsOptional() @IsString() @MaxLength(60) episodeId?: string;
  @IsOptional() @IsInt() @Min(0) positionSec?: number;
  @IsOptional() @IsInt() @Min(0) durationSec?: number;
  @IsOptional() @IsString() @MaxLength(200) sessionId?: string;
}

class SearchEventDto {
  @IsString()
  @MaxLength(200)
  query: string;

  @IsOptional() @IsInt() @Min(0) results?: number;
  @IsOptional() @IsString() @MaxLength(200) sessionId?: string;
}

/**
 * Public tracking — нэвтэрсэн ч, зочин ч бүртгэгдэнэ (userId зөвхөн нэвтэрсэн үед).
 * ⚠️ Бүгд 204 буцаана: frontend `sendBeacon` ашиглах тул хариу хүлээхгүй.
 */
@Controller('track')
@UseGuards(OptionalJwtAuthGuard)
export class TrackingController {
  constructor(private readonly svc: TrackingService) {}

  private ctx(req: Request, sessionId?: string): TrackContext {
    // ⚠️ JWT strategy нь { sub, email, role } буцаадаг — `id` БИШ `sub`
    return {
      userId: (req.user as { sub?: string } | undefined)?.sub ?? null,
      sessionId: sessionId ?? null,
      device: TrackingService.deviceFromUa(req.headers['user-agent']),
      ip: req.ip ?? null,
    };
  }

  /**
   * ⚠️ Analytics endpoint — НЭЭЛТТЭЙ тул бот хязгааргүй бичиж DB дүүргэж
   * болзошгүй. Хэвийн хэрэглэгч минутад 60 хуудас нээхгүй.
   */
  @Post('page')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(204)
  async page(@Body() dto: PageViewDto, @Req() req: Request) {
    await this.svc.pageView(dto.path, this.ctx(req, dto.sessionId), dto.referrer);
  }

  @Post('title')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(204)
  async title(@Body() dto: TitleEventDto, @Req() req: Request) {
    await this.svc.titleEvent(dto, this.ctx(req, dto.sessionId));
  }

  @Post('search')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @HttpCode(204)
  async search(@Body() dto: SearchEventDto, @Req() req: Request) {
    await this.svc.searchEvent(dto.query, dto.results ?? 0, this.ctx(req, dto.sessionId));
  }
}

/** Админ — хэрэглэгчийн бүрэн insight */
@Controller('admin/tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TrackingAdminController {
  constructor(private readonly svc: TrackingService) {}

  @Get('user/:id')
  userInsight(@Param('id') id: string) {
    return this.svc.userInsight(id);
  }
}

// ⚠️ Global — auth/wallet/payments зэрэг олон модуль audit бичдэг тул
// тус бүрд import хийхгүйгээр TrackingService-ыг шууд тарьж авна.
@Global()
@Module({
  controllers: [TrackingController, TrackingAdminController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
