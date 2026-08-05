import { Global, Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Prisma, Role, SubscriberStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { EmailService } from './email.service';

/** OTP хүчинтэй хугацаа + оролдлогын хязгаар */
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** Дараагийн код хүсэх хүртэлх хүлээлт (спам хамгаалалт) */
const OTP_RESEND_MS = 60 * 1000;

class RequestOtpDto {
  /** Имэйл солиход ШИНЭ имэйл; баталгаажуулахад хоосон */
  @IsOptional()
  @IsEmail()
  email?: string;
}

class VerifyOtpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

class SubscribeDto {
  @IsEmail()
  email: string;

  /**
   * ⚠️ HONEYPOT — хүнд ХАРАГДАХГҮЙ талбар (CSS-ээр нуусан).
   * Бот бүх талбарыг автоматаар дүүргэдэг тул энд утга ирвэл ЯГ БОТ.
   * CAPTCHA-гүйгээр ботын 90-95%-ийг барина, хэрэглэгчид ямар ч
   * саад учруулахгүй.
   */
  @IsOptional()
  @IsString()
  website?: string;

  /** Форм нээгдсэнээс хойш хэдэн мс өнгөрснийг клиент илгээнэ */
  @IsOptional()
  elapsedMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}

class BroadcastDto {
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  @MaxLength(200)
  heading: string;

  @IsString()
  bodyHtml: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ctaUrl?: string;

  /** 'subscribers' | 'users' | 'both' */
  @IsOptional()
  @IsString()
  audience?: string;
}

/**
 * Имэйл баталгаажуулалт (OTP).
 *
 * ⚠️ Код нь bcrypt-ээр HASH-лагдаж хадгалагдана — DB задарсан ч код
 * уншигдахгүй. Оролдлого 5-аар хязгаарлана (brute-force хамгаалалт).
 */
@Injectable()
export class EmailOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  private gen(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /**
   * Код илгээх.
   * @param newEmail имэйл солиход — ШИНЭ хаяг (эзэмшигчийг шалгана)
   */
  async request(userId: string, newEmail?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, emailVerified: true },
    });
    if (!user) throw new BadRequestException('Хэрэглэгч олдсонгүй');

    const purpose = newEmail ? 'change' : 'verify';
    const target = (newEmail ?? user.email).toLowerCase().trim();

    if (purpose === 'verify' && user.emailVerified) {
      throw new BadRequestException('Имэйл аль хэдийн баталгаажсан байна');
    }
    if (purpose === 'change') {
      if (target === user.email) throw new BadRequestException('Одоогийн имэйлтэй ижил байна');
      const taken = await this.prisma.user.findUnique({ where: { email: target } });
      if (taken) throw new BadRequestException('Энэ имэйл өөр бүртгэлд ашиглагдсан байна');
    }

    // ⚠️ Спам хамгаалалт — 60 секундэд нэг л код
    const recent = await this.prisma.emailOtp.findFirst({
      where: { userId, purpose, createdAt: { gt: new Date(Date.now() - OTP_RESEND_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const wait = Math.ceil((recent.createdAt.getTime() + OTP_RESEND_MS - Date.now()) / 1000);
      throw new BadRequestException(`${wait} секундын дараа дахин оролдоно уу`);
    }

    const code = this.gen();
    await this.prisma.emailOtp.create({
      data: {
        userId,
        email: target,
        codeHash: await bcrypt.hash(code, 10),
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const ok = await this.email.sendOtp({
      to: target,
      code,
      name: user.name,
      purpose,
      userId,
    });
    if (!ok) throw new BadRequestException('Имэйл илгээж чадсангүй. Хаягаа шалгана уу.');

    return { ok: true, email: target, expiresIn: OTP_TTL_MS / 1000 };
  }

  /** Код шалгах — зөв бол имэйл баталгаажна / солигдоно */
  async verify(userId: string, code: string) {
    const otp = await this.prisma.emailOtp.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Код хүчингүй эсвэл хугацаа дууссан байна');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Хэт олон удаа буруу оролдлоо. Шинэ код авна уу.');
    }

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(
        `Код буруу байна (${OTP_MAX_ATTEMPTS - otp.attempts - 1} оролдлого үлдлээ)`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: userId },
        data:
          otp.purpose === 'change'
            ? { email: otp.email, emailVerified: true }
            : { emailVerified: true },
      }),
    ]);

    return { ok: true, email: otp.email, changed: otp.purpose === 'change' };
  }
}

/** Мэдээллийн товхимол — имэйл цуглуулга */
@Injectable()
export class SubscriberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Бүртгэх (идемпотент).
   * ⚠️ Аль хэдийн байгаа бол алдаа өгөхгүй — хэрэглэгчид "аль хэдийн
   * бүртгэлтэй" гэж хэлэх нь имэйлийн жагсаалтыг задлах эрсдэлтэй.
   */
  async subscribe(dto: SubscribeDto & { userId?: string }) {
    // ── БОТЫН ШАЛГУУР ──
    // ⚠️ Ботод "амжилттай" гэж хариулна — блоклогдсоноо мэдвэл тойрч гарна
    if (dto.website) return { ok: true };
    // Хүн форм бөглөхөд хамгийн багадаа 1.5 секунд зарцуулна
    if (typeof dto.elapsedMs === 'number' && dto.elapsedMs < 1500) return { ok: true };

    const email = dto.email.toLowerCase().trim();
    if (email.endsWith('@guest.besttv.mn')) return { ok: true };

    // ⚠️ Түр зуурын (disposable) имэйл — жагсаалт бохирдоно, bounce өснө,
    // SES-ийн нэр хүнд муудна
    const DISPOSABLE = [
      'mailinator.com', 'guerrillamail.com', 'tempmail', '10minutemail',
      'throwaway', 'yopmail.com', 'trashmail', 'sharklasers.com', 'getnada.com',
    ];
    const domain = email.split('@')[1] ?? '';
    if (DISPOSABLE.some((d) => domain.includes(d))) {
      return { ok: true };
    }

    await this.prisma.subscriber.upsert({
      where: { email },
      create: {
        email,
        name: dto.name,
        source: dto.source ?? 'homepage',
        userId: dto.userId,
      },
      update: {
        // Дахин бүртгэвэл цуцалсан хаягийг сэргээнэ
        status: SubscriberStatus.ACTIVE,
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.userId ? { userId: dto.userId } : {}),
      },
    });
    return { ok: true };
  }

  async unsubscribe(email: string) {
    await this.prisma.subscriber
      .update({
        where: { email: email.toLowerCase().trim() },
        data: { status: SubscriberStatus.UNSUBSCRIBED },
      })
      .catch(() => null);
    return { ok: true };
  }

  async list(params: {
    q?: string;
    status?: string;
    source?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Number(params.limit) || 20);

    const where: Prisma.SubscriberWhereInput = {};
    if (params.q?.trim()) {
      where.OR = [
        { email: { contains: params.q.trim(), mode: 'insensitive' } },
        { name: { contains: params.q.trim(), mode: 'insensitive' } },
      ];
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as SubscriberStatus;
    }
    if (params.source && params.source !== 'ALL') where.source = params.source;

    const [items, total, counts] = await Promise.all([
      this.prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscriber.count({ where }),
      this.prisma.subscriber.groupBy({ by: ['status'], _count: true }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    };
  }

  /** CSV export — маркетингийн хэрэгсэлд оруулах */
  async exportCsv(status?: string) {
    const rows = await this.prisma.subscriber.findMany({
      where: status && status !== 'ALL' ? { status: status as SubscriberStatus } : {},
      orderBy: { createdAt: 'desc' },
      take: 50_000,
    });
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      'Имэйл,Нэр,Эх сурвалж,Төлөв,Бүртгүүлсэн',
      ...rows.map((r) =>
        [r.email, r.name ?? '', r.source ?? '', r.status, r.createdAt.toISOString()]
          .map(esc)
          .join(','),
      ),
    ];
    // ⚠️ BOM — Excel дээр кирилл зөв харагдана
    return { csv: '﻿' + lines.join('\n'), count: rows.length };
  }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

@Controller('email')
export class EmailPublicController {
  constructor(private readonly subs: SubscriberService) {}

  /** Мэдээллийн товхимолд бүртгүүлэх (нэвтрэх шаардлагагүй) */
  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeDto) {
    return this.subs.subscribe(dto);
  }

  @Post('unsubscribe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  unsubscribe(@Body('email') email: string) {
    return this.subs.unsubscribe(email);
  }
}

@Controller('email/otp')
@UseGuards(JwtAuthGuard)
export class EmailOtpController {
  constructor(private readonly svc: EmailOtpService) {}

  /** Код илгээх (баталгаажуулах эсвэл имэйл солих) */
  @Post('request')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  request(@CurrentUser() user: JwtPayload, @Body() dto: RequestOtpDto) {
    return this.svc.request(user.sub, dto.email);
  }

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyOtpDto) {
    return this.svc.verify(user.sub, dto.code);
  }
}

/** Олноор устгах хүсэлт — захиалагч болон имэйл лог хоёуланд ижил хэлбэр */
class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids: string[];
}

@Controller('admin/email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmailAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subs: SubscriberService,
    private readonly email: EmailService,
  ) {}

  /** Илгээсэн имэйлийн лог */
  @Get('logs')
  async logs(
    @Query('template') template?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.min(200, Number(limit) || 20);
    const where: Prisma.EmailLogWhereInput = {};
    if (template && template !== 'ALL') where.template = template;
    if (status && status !== 'ALL') where.status = status;
    if (search?.trim()) where.to = { contains: search.trim(), mode: 'insensitive' };

    const [items, total, byStatus] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.groupBy({ by: ['status'], _count: true }),
    ]);

    return {
      items,
      total,
      page: p,
      limit: take,
      totalPages: Math.ceil(total / take),
      stats: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    };
  }

  /** Мэдээллийн товхимолд бүртгүүлэгчид */
  @Get('subscribers')
  subscribers(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.subs.list({ q, status, source, page, limit });
  }

  @Get('subscribers/export')
  exportSubscribers(@Query('status') status?: string) {
    return this.subs.exportCsv(status);
  }

  /**
   * Захиалагчдыг олноор устгана (тест бүртгэл цэвэрлэх).
   *
   * ⚠️ ЖИНХЭНЭ устгал — "unsubscribe" БИШ. Хэрэглэгч өөрөө татгалзсан бол
   * `status: UNSUBSCRIBED` үлдэх ёстой (дахин илгээхээс сэргийлнэ); энэ нь
   * зөвхөн админ гар аргаар хогийн бүртгэл цэвэрлэхэд зориулагдсан.
   */
  @Post('subscribers/bulk-delete')
  async bulkDeleteSubscribers(@Body() dto: BulkDeleteDto) {
    if (!dto.ids.length) return { deleted: 0 };
    const res = await this.prisma.subscriber.deleteMany({
      where: { id: { in: dto.ids } },
    });
    return { deleted: res.count };
  }

  /** Илгээсэн имэйлийн логийг олноор устгана (тест лог хуримтлагддаг) */
  @Post('logs/bulk-delete')
  async bulkDeleteLogs(@Body() dto: BulkDeleteDto) {
    if (!dto.ids.length) return { deleted: 0 };
    const res = await this.prisma.emailLog.deleteMany({
      where: { id: { in: dto.ids } },
    });
    return { deleted: res.count };
  }

  /** Suppression жагсаалт (bounce/complaint) */
  @Get('suppressions')
  suppressions(@Query('limit') limit?: number) {
    return this.prisma.emailSuppression.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Number(limit) || 50),
    });
  }

  /**
   * Олноор имэйл илгээх.
   * ⚠️ Дарааллаар (300ms зайтай) илгээгдэнэ — SES-ийн хязгаарт цохиулахгүй.
   */
  @Post('broadcast')
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  async broadcast(@Body() dto: BroadcastDto) {
    const audience = dto.audience ?? 'subscribers';
    const targets = new Set<string>();

    if (audience === 'subscribers' || audience === 'both') {
      const rows = await this.prisma.subscriber.findMany({
        where: { status: SubscriberStatus.ACTIVE },
        select: { email: true },
      });
      rows.forEach((r) => targets.add(r.email));
    }
    if (audience === 'users' || audience === 'both') {
      const rows = await this.prisma.user.findMany({
        where: { isActive: true, emailVerified: true },
        select: { email: true },
      });
      rows.forEach((r) => targets.add(r.email));
    }

    for (const to of targets) {
      this.email.sendMarketing({
        to,
        subject: dto.subject,
        heading: dto.heading,
        bodyHtml: dto.bodyHtml,
        ctaText: dto.ctaText,
        ctaUrl: dto.ctaUrl,
      });
    }

    return { queued: targets.size };
  }
}

/**
 * Имэйл модуль.
 * ⚠️ @Global — EmailService нь auth/payments/rentals зэрэг олон модульд
 * хэрэгтэй тул бүрд нь import бичихгүй.
 */
@Global()
@Module({
  controllers: [EmailPublicController, EmailOtpController, EmailAdminController],
  providers: [EmailService, EmailOtpService, SubscriberService],
  exports: [EmailService, SubscriberService],
})
export class EmailModule {}
