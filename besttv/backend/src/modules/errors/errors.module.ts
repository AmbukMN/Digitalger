import {
  Body,
  Controller,
  Get,
  Headers,
  Injectable,
  Logger,
  Module,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role } from '@prisma/client';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * АЛДААНЫ БҮРТГЭЛ.
 *
 * ⚠️⚠️ ЯАГААД: «зарим хэрэглэгч үзэж чадахгүй байна», «мөнгө шилжихгүй
 * байна» гэсэн гомдол ирэхэд ЯМАР алдаа, ХЭДЭН хүнд, ЯМАР төхөөрөмж
 * дээр гарсныг мэдэх арга ОГТ БАЙГААГҮЙ. Browser талын алдаа хаана ч
 * үлддэггүй, backend-ийнх зөвхөн docker лог руу бичигдэж хайхад бэрх.
 *
 * ⚠️ Хувийн мэдээлэл ХАДГАЛАХГҮЙ — зөвхөн техникийн контекст.
 */

/** ⚠️ Урт хязгаар — лог хүснэгт хязгааргүй өсөхөөс сэргийлнэ */
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

class ReportErrorDto {
  @IsString()
  @MaxLength(MAX_MESSAGE)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_STACK)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  /** ⚠️ Зөвхөн энэ хоёр утга — дурын эх сурвалж бүртгүүлэхгүй */
  @IsOptional()
  @IsIn(['client', 'server'])
  source?: 'client' | 'server';

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

@Injectable()
export class ErrorsService {
  private readonly logger = new Logger(ErrorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Алдаа бүртгэх.
   *
   * ⚠️⚠️ ХЭЗЭЭ Ч ШИДЭХГҮЙ. Алдаа бүртгэх үйлдэл өөрөө унавал хэрэглэгчийн
   * үндсэн урсгал тасрах ёсгүй — лог бол НЭМЭЛТ зүйл.
   */
  async record(input: {
    source: 'client' | 'server';
    message: string;
    stack?: string | null;
    path?: string | null;
    userId?: string | null;
    userAgent?: string | null;
    meta?: Record<string, unknown> | null;
  }) {
    try {
      await this.prisma.errorLog.create({
        data: {
          source: input.source,
          message: input.message.slice(0, MAX_MESSAGE),
          stack: input.stack?.slice(0, MAX_STACK) ?? null,
          path: input.path?.slice(0, 500) ?? null,
          userId: input.userId ?? null,
          userAgent: input.userAgent?.slice(0, 400) ?? null,
          meta: (input.meta ?? undefined) as never,
        },
      });
    } catch (e) {
      this.logger.error(`Алдаа бүртгэж чадсангүй: ${String(e)}`);
    }
    return { ok: true };
  }

  /** Админ жагсаалт — шүүлт + хуудаслалт */
  async list(opts: { page?: number; source?: string; q?: string }) {
    const page = Math.max(1, Number(opts.page) || 1);
    const take = 50;
    const where: Record<string, unknown> = {};
    if (opts.source === 'client' || opts.source === 'server') where.source = opts.source;
    if (opts.q?.trim()) {
      where.OR = [
        { message: { contains: opts.q.trim(), mode: 'insensitive' } },
        { path: { contains: opts.q.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.errorLog.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / take)) };
  }

  /**
   * Хураангуй — ижил алдааг бүлэглэж ХЭДЭН УДАА гарсныг харуулна.
   * ⚠️ Энэ бол хамгийн хэрэгтэй харагдац: 1 хүний 1 алдаа vs
   *    100 хүнд гарсан алдаа хоёрыг ЯЛГАНА.
   */
  async summary(hours = 24) {
    const since = new Date(Date.now() - hours * 3600_000);
    const rows = await this.prisma.errorLog.groupBy({
      by: ['message', 'source'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { message: 'desc' } },
      take: 20,
    });
    return rows.map((r) => ({
      message: r.message,
      source: r.source,
      count: r._count._all,
    }));
  }

  /**
   * ⚠️ 30 хоногоос хуучин логийг устгана — хүснэгт хязгааргүй өсвөл
   * DB дүүрч, админ жагсаалт удааширна.
   */
  @Cron('0 4 * * *')
  async cleanup() {
    try {
      const cutoff = new Date(Date.now() - 30 * 86400_000);
      const { count } = await this.prisma.errorLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (count) this.logger.log(`Хуучин алдааны лог устгав: ${count}`);
    } catch (e) {
      this.logger.error(`Лог цэвэрлэх амжилтгүй: ${String(e)}`);
    }
  }
}

@Controller('errors')
export class ErrorsController {
  constructor(private readonly svc: ErrorsService) {}

  /**
   * Browser-ээс алдаа мэдээлэх.
   *
   * ⚠️ НЭЭЛТТЭЙ (зочин ч мэдээлнэ) — нэвтрээгүй хэрэглэгчийн алдаа ч
   *    адил чухал. Гэхдээ `@Throttle` заавал: эс бөгөөс хэн нэгэн
   *    хүснэгтийг сая мөрөөр дүүргэж болно.
   */
  @Post('report')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  report(
    @Body() dto: ReportErrorDto,
    @CurrentUser() user: JwtPayload | null,
    /* ⚠️ `User-Agent`-ыг СЕРВЕР талаас авна — client-ийн илгээснийг
       найдвартай гэж үзэхгүй (хуурамч утга оруулж болно) */
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.svc.record({
      source: dto.source ?? 'client',
      message: dto.message,
      stack: dto.stack,
      path: dto.path,
      userId: user?.sub ?? null,
      userAgent,
      meta: dto.meta,
    });
  }
}

@Controller('admin/errors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ErrorsAdminController {
  constructor(private readonly svc: ErrorsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('source') source?: string, @Query('q') q?: string) {
    return this.svc.list({ page: Number(page) || 1, source, q });
  }

  @Get('summary')
  summary(@Query('hours') hours?: string) {
    return this.svc.summary(Math.min(168, Math.max(1, Number(hours) || 24)));
  }
}

@Module({
  controllers: [ErrorsController, ErrorsAdminController],
  providers: [ErrorsService],
  exports: [ErrorsService],
})
export class ErrorsModule {}
