import { Global, Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
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
import { EmailEventsService } from './email-events.service';
import { verifySnsSignature } from './sns-signature.util';
import { EmailService } from './email.service';

/**
 * 1×1 тунгалаг GIF — имэйл нээлт хянах pixel.
 * ⚠️ base64-аас НЭГ УДАА decode хийж кэшилнэ (дуудалт бүрд биш).
 */
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

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

  /**
   * ⚠️⚠️ ХОЁР ГАЗАРТ бичнэ — эс бөгөөс цуцалсан хүнд ДАХИН имэйл явна.
   *
   * БОДИТ АЛДАА: өмнө нь зөвхөн `Subscriber` хүснэгтийг шинэчилдэг
   * байсан. Гэтэл `broadcast` нь `audience: 'users'` үед `User`
   * хүснэгтээс (isActive+emailVerified) сонгодог тул БҮРТГЭЛТЭЙ
   * хэрэглэгч цуцалсан ч маркетинг имэйл авсаар байв (CAN-SPAM зөрчил).
   */
  async unsubscribe(email: string) {
    const clean = email.toLowerCase().trim();
    await Promise.all([
      this.prisma.subscriber
        .updateMany({ where: { email: clean }, data: { status: SubscriberStatus.UNSUBSCRIBED } })
        .catch(() => null),
      /* Бүртгэлтэй хэрэглэгчийн маркетинг татгалзал */
      this.prisma.user
        .updateMany({ where: { email: clean }, data: { marketingOptOut: true } })
        .catch(() => null),
    ]);
    return { ok: true };
  }

  /**
   * Имэйл нээлт бүртгэх (1×1 pixel-ээс).
   *
   * ⚠️ FIRE-AND-FORGET — `await` ХИЙХГҮЙ. Pixel-ийн хариу DB-г
   *    хүлээвэл шуудангийн клиент дээр зураг удаан ачаалагдана.
   *
   * ⚠️ ХОЁР газарт бичнэ:
   *    1. `EmailOpen` — нээлт БҮР (unique openers тоолоход)
   *    2. `EmailLog.openCount/openedAt` — хурдан харуулах хураангуй
   */
  recordOpen(o: { email: string; logId?: string; template: string; userAgent?: string }) {
    const email = o.email.toLowerCase().trim();

    void this.prisma.emailOpen
      .create({
        data: {
          email,
          logId: o.logId ?? null,
          template: o.template,
          userAgent: o.userAgent?.slice(0, 300) ?? null,
        },
      })
      .catch(() => null);

    /* ⚠️ Эхний нээлтийг ДАРЖ БИЧИХГҮЙ — «хэр хурдан нээв» гол хэмжүүр */
    if (o.logId) {
      void this.prisma.emailLog
        .updateMany({
          where: { id: o.logId, openedAt: null },
          data: { openedAt: new Date() },
        })
        .catch(() => null);
      void this.prisma.emailLog
        .updateMany({ where: { id: o.logId }, data: { openCount: { increment: 1 } } })
        .catch(() => null);
    }
  }

  /**
   * Захиалагчийн шүүлтүүрийг `where` болгоно.
   *
   * ⚠️ НЭГ ЭХ СУРВАЛЖ — `list` ба `exportCsv` ХОЁУЛАА үүнийг ашиглана.
   * Өмнө нь export нь өөрийн гэсэн хагас логиктой байсан тул CSV нь
   * дэлгэц дээрх жагсаалтаас ӨӨР үр дүн буцаадаг байв.
   */
  private subscriberWhere(params: {
    q?: string;
    status?: string;
    source?: string;
  }): Prisma.SubscriberWhereInput {
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
    return where;
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

    const where = this.subscriberWhere(params);

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

  /**
   * CSV export — маркетингийн хэрэгсэлд оруулах.
   *
   * ⚠️ Дэлгэц дээр харагдаж буй шүүлтүүрийг ЯГ дагана (`subscriberWhere`).
   * Өмнө нь зөвхөн `status` баримталдаг байсан тул шүүсэн 40 мөрийн
   * оронд БҮХ захиалагч татагдаж, зөвшөөрөөгүй хүнд имэйл явах
   * эрсдэлтэй байв.
   */
  async exportCsv(status?: string, q?: string, source?: string) {
    const rows = await this.prisma.subscriber.findMany({
      where: this.subscriberWhere({ status, q, source }),
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

  /**
   * ⚠️⚠️ ИМЭЙЛ НЭЭЛТ ХЯНАХ PIXEL — AWS-гүй, өөрийн шийдэл.
   *
   * Имэйлд суулгасан 1×1 GIF-ийг шуудангийн клиент татахад энэ дуудагдана.
   * DigitalGer дээр аль хэдийн ажиллаж байгаа зарчим.
   *
   * ⚠️ SES Configuration Set ШААРДЛАГАГҮЙ — AWS консол дээр юу ч хийхгүй.
   *
   * ⚠️ `@SkipThrottle()` ЗААВАЛ: шуудангийн клиент нээх бүрд дуудна,
   *    нэг хүн олон удаа нээж болно. Throttle тавибал бодит нээлт
   *    бүртгэгдэхгүй.
   *
   * ⚠️ ЯМАР Ч алдаа гарсан GIF-ийг ЗААВАЛ буцаана — эс бөгөөс
   *    хэрэглэгчийн имэйлд эвдэрсэн зургийн дүрс гарна.
   */
  @SkipThrottle()
  @Get('open')
  async open(
    @Query('l') logId: string | undefined,
    @Query('e') email: string | undefined,
    @Query('t') template: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    /* ⚠️ Fire-and-forget — DB бичилт pixel-ийн хариуг ХҮЛЭЭЛГЭХГҮЙ */
    if (email && template) {
      this.subs.recordOpen({
        email,
        logId,
        template,
        userAgent: req.headers['user-agent'],
      });
    }

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.length),
      /* ⚠️ Кэшлэхгүй — эс бөгөөс 2 дахь нээлт бүртгэгдэхгүй */
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(PIXEL_GIF);
  }
}

/**
 * AWS SES → SNS үйл явдлын webhook.
 *
 * ⚠️⚠️⚠️ ГАРЫН ҮСЭГ ЗААВАЛ ШАЛГАНА — АЮУЛГҮЙ БАЙДЛЫН ГОЛ ЦЭГ.
 *
 * БОДИТ ЭРСДЭЛ: энэ нь нээлттэй endpoint (SNS токен дамжуулдаггүй).
 * Гарын үсэг шалгахгүй бол ХЭН Ч хуурамч «bounce» илгээж, дурын
 * хаягийг МӨНХӨД хориглуулж чадна → тэр хүн нууц үг сэргээх,
 * OTP авах боломжгүй болно. Энэ нь «статистик гажина» гэдгээс
 * хамаагүй ноцтой (өмнөх коммент үүнийг дутуу үнэлсэн).
 *
 * ⚠️ SNS нь `Content-Type: text/plain` илгээдэг тул Nest биеийг
 *    задлахгүй. `rawBody`-оос гараар JSON.parse хийнэ (main.ts-д
 *    `rawBody: true` тохируулсан).
 *
 * ⚠️ ҮРГЭЛЖ 200 буцаана. Алдаа буцаавал SNS дахин дахин илгээж, эцэст
 *    нь subscription-ыг ӨӨРӨӨ УНТРААДАГ (бүх хяналт чимээгүй зогсоно).
 */
@Controller('email/events')
export class EmailEventsController {
  private readonly log = new Logger('EmailEventsController');

  constructor(private readonly events: EmailEventsService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async sns(@Req() req: RawBodyRequest<Request>, @Body() body: unknown) {
    try {
      /* ── 1. Биеийг унших (rawBody давуу — гарын үсэг түүгээр шалгана) ── */
      let payload: Record<string, unknown>;
      const raw = req.rawBody?.toString('utf8');
      if (raw) {
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          this.log.warn('SNS бие JSON биш');
          return { ok: true, action: 'bad-json' };
        }
      } else if (body && typeof body === 'object') {
        payload = body as Record<string, unknown>;
      } else {
        return { ok: true, action: 'empty-body' };
      }

      /* ── 2. ГАРЫН ҮСЭГ — шалгалт давахгүй бол ХАЯНА ── */
      const valid = await verifySnsSignature(payload);
      if (!valid) {
        this.log.warn('SNS гарын үсэг БУРУУ — хаялаа');
        /* ⚠️ 200 буцаана — халдагчид «барив» гэж мэдэгдэхгүй */
        return { ok: true, action: 'invalid-signature' };
      }

      return await this.events.handle(payload as never);
    } catch (e) {
      /* ⚠️ Алдаа гарсан ч 200 — SNS-ийн дахин илгээлтийг зогсооно */
      this.log.error(`SNS боловсруулахад алдаа: ${String(e)}`);
      return { ok: true, action: 'error-swallowed' };
    }
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
    /** 'yes' = нээсэн, 'no' = нээгээгүй, эсвэл хоосон = бүгд */
    @Query('opened') opened?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.min(200, Number(limit) || 20);
    const where: Prisma.EmailLogWhereInput = {};
    if (template && template !== 'ALL') where.template = template;
    if (status && status !== 'ALL') where.status = status;
    /**
     * ⚠️ ХАЙЛТ нь ГАРЧГААР ч хайна — өмнө нь зөвхөн `to` талбарыг
     * шалгадаг байсан тул «нууц үг» гэж хайхад юу ч олдохгүй байв.
     */
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { to: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ];
    }

    /**
     * ⚠️ Нээлтийн шүүлт — «нээсэн / нээгээгүй» гэж ялгах.
     * `opened=yes` → openedAt бий; `opened=no` → зөвхөн ИЛГЭЭГДСЭН
     * мөрүүдээс (амжилтгүйг «нээгээгүй» гэж тоолох нь утгагүй).
     */
    if (opened === 'yes') where.openedAt = { not: null };
    else if (opened === 'no') {
      where.openedAt = null;
      where.status = where.status ?? 'sent';
    }

    const [items, total, byStatus, agg] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.prisma.emailLog.count({ where }),
      /**
       * ⚠️ БОДИТ АЛДАА: `where` ОРООГҮЙ байсан тул шүүлт хийхэд ч
       * статистикийн картууд ДЭЛХИЙН нийт тоог харуулсаар байв —
       * жагсаалт 3 мөр атал «Илгээгдсэн 14» гэж зөрөх.
       */
      this.prisma.emailLog.groupBy({ by: ['status'], where, _count: true }),
      /** Хүргэлт/нээлт/дарсан — insight самбарт */
      this.prisma.emailLog.aggregate({
        where: { ...where, status: 'sent' },
        _count: { openedAt: true, clickedAt: true, deliveredAt: true, bouncedAt: true },
      }),
    ]);

    const stats = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const sent = (stats.sent as number) ?? 0;

    return {
      items,
      total,
      page: p,
      limit: take,
      totalPages: Math.ceil(total / take),
      stats,
      /**
       * ⚠️ Хувийг BACKEND талд бодно — UI-д давхардаж бодуулбал
       * хуудас бүрт өөр өөрөөр тооцох эрсдэлтэй.
       */
      insight: {
        sent,
        delivered: agg._count.deliveredAt,
        opened: agg._count.openedAt,
        clicked: agg._count.clickedAt,
        bounced: agg._count.bouncedAt,
        openRate: sent ? Math.round((agg._count.openedAt / sent) * 100) : 0,
        clickRate: sent ? Math.round((agg._count.clickedAt / sent) * 100) : 0,
        deliveryRate: sent ? Math.round((agg._count.deliveredAt / sent) * 100) : 0,
        /**
         * ⚠️⚠️ ХОЁР ӨӨР ХЯНАЛТ — ЯЛГАХ ЁСТОЙ:
         *
         *   openTracking     — өөрийн 1×1 pixel (`/api/email/open`).
         *                      AWS тохиргоо ШААРДЛАГАГҮЙ, ҮРГЭЛЖ ажиллана.
         *                      Зөвхөн МАРКЕТИНГ имэйлд суудаг (нууц үг/OTP-д
         *                      pixel тавихгүй — шүүлтүүр сэжиглэдэг).
         *
         *   deliveryTracking — AWS SES Configuration Set + SNS.
         *                      Хүргэгдсэн/буцаагдсан эсэхийг мэдэхэд хэрэгтэй.
         *                      Тохируулаагүй бол зөвхөн ЭНЭ хэсэг дутна.
         *
         * ⚠️ Өмнө нь нэг л туг байсан тул «нээлт хянахад AWS хэрэгтэй»
         *    гэсэн ХУДАЛ ойлголт өгдөг байв — үнэндээ хэрэггүй.
         */
        openTracking: agg._count.openedAt > 0,
        deliveryTracking: agg._count.deliveredAt > 0,
        /** @deprecated Хуучин UI-д зориулав — `deliveryTracking` ашигла */
        trackingActive: agg._count.deliveredAt > 0 || agg._count.openedAt > 0,
      },
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

  /**
   * ⚠️⚠️ CSV нь ЖАГСААЛТТАЙ ЯГ ИЖИЛ шүүлтүүр хүлээж авна.
   *
   * БОДИТ АЛДАА: зөвхөн `status` дэмждэг байв. Админ `source=footer`
   * + «gmail» хайлт хийж 40 мөр хараад CSV дарахад БҮХ захиалагч
   * (мянга мянган мөр) татагддаг. Тэр жагсаалтаар сурталчилгаа
   * илгээвэл ЗӨВШӨӨРӨӨГҮЙ хүмүүст очих эрсдэлтэй.
   */
  @Get('subscribers/export')
  exportSubscribers(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('source') source?: string,
  ) {
    return this.subs.exportCsv(status, q, source);
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
        /**
         * ⚠️⚠️ `marketingOptOut: false` ЗААВАЛ — CAN-SPAM шаардлага.
         *
         * БОДИТ АЛДАА: өмнө нь зөвхөн `isActive`+`emailVerified`-ээр
         * шүүдэг байсан тул цуцалсан ХЭРЭГЛЭГЧ рүү маркетинг имэйл
         * ДАХИН ДАХИН явдаг байв (цуцлалт нь зөвхөн `Subscriber`
         * хүснэгтэд бичигддэг байсан).
         *
         * ⚠️ Зочин хаяг ч хасна — тэднийг илгээх шатанд шүүдэг ч
         *    энд хасвал дэмий дараалалд орохгүй.
         */
        where: {
          isActive: true,
          emailVerified: true,
          marketingOptOut: false,
          isGuest: false,
        },
        select: { email: true },
      });
      rows.forEach((r) => targets.add(r.email));
    }

    /**
     * ⚠️ ЦУЦАЛСАН хаягийг ЭЦСИЙН шатанд ч хасна — `Subscriber`-т
     * цуцалсан хүн `User` хүснэгтээр дамжин орж ирэх боломжтой
     * (audience='both' үед хоёр эх сурвалж нэгддэг).
     */
    if (targets.size) {
      const optedOut = await this.prisma.subscriber.findMany({
        where: {
          email: { in: [...targets] },
          status: { in: [SubscriberStatus.UNSUBSCRIBED, SubscriberStatus.BOUNCED] },
        },
        select: { email: true },
      });
      optedOut.forEach((r) => targets.delete(r.email));
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
  controllers: [EmailPublicController, EmailOtpController, EmailAdminController, EmailEventsController],
  providers: [EmailService, EmailOtpService, SubscriberService, EmailEventsService],
  exports: [EmailService, SubscriberService],
})
export class EmailModule {}
