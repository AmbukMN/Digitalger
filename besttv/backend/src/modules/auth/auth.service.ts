import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService, MAX_DEVICES, type DeviceContext } from './session.service';
import { EmailService } from '../email/email.service';
import { SubscriberService } from '../email/email.module';
import { StorageService } from '../../storage/storage.service';
import { TrackingService } from '../tracking/tracking.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { OAuthLoginDto } from './dto/oauth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Нууц үг сэргээх линкийн хүчинтэй хугацаа.
 * ⚠️ Богино байх тусам аюулгүй (имэйл хайрцаг задарсан үед ашиглагдах
 * цонх багасна), гэхдээ хэрэглэгч имэйлээ шалгаж амжих ёстой — 1 цаг
 * нь салбарын нийтлэг тэнцвэр.
 */
const RESET_TTL_MS = 60 * 60 * 1000;

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    avatarUrl: string | null;
    isGuest: boolean;
  };
}


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly tracking: TrackingService,
    private readonly email: EmailService,
    private readonly subscribers: SubscriberService,
    /* ⚠️ Төхөөрөмжийн хязгаар (MAX_DEVICES) — нэг эрхээр хязгааргүй
       хүн зэрэг үзэхээс сэргийлнэ */
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto, ctx: DeviceContext = {}): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Энэ имэйл бүртгэлтэй байна');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name?.trim() || null, emailVerified: false },
    });

    await this.tracking.audit(user.id, 'register', { newValue: email });

    // ⚠️ Имэйл дараалалд орно — HTTP хариу удаашрахгүй (queueSend)
    this.email.sendWelcome({ to: email, name: user.name, userId: user.id });
    // Бүртгүүлсэн хэрэглэгчийг мэдээллийн товхимолд ч нэмнэ
    void this.subscribers
      .subscribe({ email, name: user.name ?? undefined, source: 'register', userId: user.id })
      .catch(() => null);

    return this.buildAuthResult(user, ctx);
  }

  async login(dto: LoginDto, ctx: DeviceContext = {}): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Имэйл эсвэл нууц үг буруу байна');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Таны бүртгэл хаагдсан байна');
    }
    // ⚠️ Хуучин зочин бүртгэл нэвтрэх боломжгүй (guest горим хаагдсан)
    if (user.isGuest) {
      throw new UnauthorizedException('Зочин бүртгэл дэмжигдэхээ больсон. Шинээр бүртгүүлнэ үү.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Имэйл эсвэл нууц үг буруу байна');

    await this.tracking.audit(user.id, 'login');
    return this.buildAuthResult(user, ctx);
  }

  /** Админ нэвтрэлт — зөвхөн ADMIN role */
  async adminLogin(dto: LoginDto, ctx: DeviceContext = {}): Promise<AuthResult> {
    const result = await this.login(dto, ctx);
    if (result.user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Админ эрхгүй байна');
    }
    return result;
  }

  async refresh(refreshToken: string, ctx: DeviceContext = {}): Promise<AuthTokens> {
    let user: User | null = null;
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error();
    } catch {
      throw new UnauthorizedException('Refresh token хүчингүй байна');
    }

    /**
     * ⚠️⚠️ SESSION ШАЛГАЛТ — ТӨХӨӨРӨМЖИЙН ХЯЗГААР ЭНД ХЭРЭГЖИНЭ.
     *
     * JWT нь өөрөө хүчинтэй байсан ч session устсан бол (3 дахь
     * төхөөрөмж нэвтэрч энэ нь ГАРСАН) дахин нэвтрэх шаардлагатай.
     * Энэ шалгалтгүй бол хязгаар утгагүй — токен 30 хоног ажиллана.
     *
     * ⚠️ Мессеж нь ТОДОРХОЙ байх ёстой — хэрэглэгч «яагаад гарчихав»
     * гэж эргэлзэхээс сэргийлнэ.
     */
    const valid = await this.sessions.touch(user.id, refreshToken);
    if (!valid) {
      throw new UnauthorizedException(
        `Өөр төхөөрөмжөөс нэвтэрсэн тул та гарсан байна (дээд тал нь ${MAX_DEVICES} төхөөрөмж). Дахин нэвтэрнэ үү.`,
      );
    }

    const tokens = this.signTokens(user);
    /* ⚠️ ROTATION — хуучин токен устаж шинэ нь бүртгэгдэнэ. Нэг
       төхөөрөмж 2 мөр эзлэхгүй, хулгайлагдсан токен ч хүчингүй болно. */
    await this.sessions.rotate(user.id, refreshToken, tokens.refreshToken, ctx, this.refreshExpiryDate());
    return tokens;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarKey: true,
        isGuest: true,
        provider: true,
        emailVerified: true,
        walletBalance: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException();

    // Идэвхтэй эрх — frontend "Premium" төлөв харуулахад.
    // Хэрэглэгч олон багц зэрэг авч болно (Монгол + Солонгос гэх мэт).
    const activeSubs = await this.prisma.subscription.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            isVip: true,
            genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
          },
        },
      },
    });

    /**
     * ⚠️⚠️ ИДЭВХТЭЙ ТҮРЭЭС — картын badge зөв харуулахад ЗААВАЛ.
     *
     * Түрээс нь БАГЦ БИШ, кино тус бүрийн эрх. Өмнө нь энэ мэдээлэл
     * frontend-д ОГТ ирдэггүй байсан тул хэрэглэгч киног түрээслэсэн
     * атлаа жагсаалтад "🔒 Төлбөртэй" гэж харагдсаар байв (эрх нь
     * ажилладаг ч хэрэглэгч эргэлздэг).
     */
    const activeRentals = await this.prisma.rental.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { titleId: true },
    });

    const activeSub = activeSubs[0] ?? null;

    return {
      ...user,
      avatarUrl: user.avatarKey ? await this.storage.publicAssetUrl(user.avatarKey, 7200) : null,
      avatarKey: undefined,
      // Хамгийн сүүлд дуусах багц (backward-compat — хуучин UI ашигладаг)
      subscription: activeSub
        ? { planName: activeSub.plan.name, expiresAt: activeSub.expiresAt }
        : null,
      /**
       * Идэвхтэй БҮХ багц — аль контент нээлттэйг UI-д харуулахад.
       *
       * ⚠️ VIP нь БҮХ контентыг нээдэг тул VIP идэвхтэй үед бусад жанрын
       * багцууд ИЛҮҮДЭЛ болно → `supersededByVip: true`. Хугацаа нь
       * зогсохгүй, зүгээр л UI-д "VIP-д багтсан" гэж тэмдэглэгдэнэ.
       * (Хэрэглэгч хүсвэл бусад багцыг хэдийд ч авах боломжтой хэвээр.)
       */
      subscriptions: activeSubs.map((s) => ({
        planId: s.plan.id,
        planName: s.plan.name,
        isVip: s.plan.isVip,
        expiresAt: s.expiresAt,
        genres: s.plan.genres.map((g) => g.genre),
        supersededByVip: !s.plan.isVip && activeSubs.some((x) => x.plan.isVip),
      })),
      /** VIP багц идэвхтэй эсэх — UI-д хурдан шалгахад */
      hasVip: activeSubs.some((s) => s.plan.isVip),
      /** VIP эсвэл нээлттэй жанрын ID-үүд — card lock тооцоход */
      accessGenreIds: activeSubs.some((s) => s.plan.isVip)
        ? 'ALL'
        : [...new Set(activeSubs.flatMap((s) => s.plan.genres.map((g) => g.genre.id)))],
      /** Ширхэгээр түрээслэсэн киноны ID — картын badge-д (багцаас ТУСДАА) */
      rentedTitleIds: activeRentals.map((r) => r.titleId),
    };
  }

  /**
   * OAuth (Google/Facebook) нэвтрэлт — frontend NextAuth-аас provider profile
   * ирнэ. Байгаа providerId-аар олно → байхгүй бол email-ээр холбоно (жишээ
   * нь эхлээд имэйлээр бүртгүүлсэн хэрэглэгч дараа Google-аар нэвтрэхэд ижил
   * акаунт руу холбогдоно) → аль нь ч биш бол шинэ хэрэглэгч үүсгэнэ.
   */
  async oauthLogin(
    dto: OAuthLoginDto,
    sharedSecret?: string,
    ctx: DeviceContext = {},
  ): Promise<AuthResult> {
    /**
     * ⚠️⚠️⚠️ ЭНЭ ШАЛГАЛТЫГ ХЭЗЭЭ Ч БҮҮ ХАС — БҮРТГЭЛ БУЛААХ ЦООРХОЙ.
     *
     * Энэ endpoint нь `providerAccountId` + `email`-ийг ИТГЭЖ авдаг:
     * имэйлээр хэрэглэгчийг олоод ТҮҮНИЙ токеныг буцаана. Өмнө нь ямар
     * ч баталгаажуулалт байгаагүй тул production дээр дараах curl
     * АЖИЛЛАЖ БАЙВ (бодитоор тестлэсэн — ADMIN токен гарсан):
     *
     *   POST /api/auth/oauth
     *   {"provider":"google","providerAccountId":"хоосон утга",
     *    "email":"admin@besttv.mn"}
     *
     * → admin@besttv.mn-ий ЖИНХЭНЭ токен, `role: ADMIN`-тай.
     * Нууц үг огт хэрэггүй. Ингээд `/admin/wallet/:id/credit` (мөнгө),
     * `/admin/users/:id/password` (бүртгэл булаах) бүгд нээгдэнэ.
     *
     * ЯАГААД ХУВААЛЦСАН НУУЦ ВЭ (id_token шалгахын оронд):
     * Энэ endpoint-ыг ЗӨВХӨН манай Next.js СЕРВЕР дууддаг (browser БИШ)
     * — `/api/auth/bridge` болон `lib/auth.ts`. Google/Facebook-ийн
     * жинхэнэ баталгаажуулалтыг NextAuth аль хэдийн хийсэн байдаг тул
     * дахин шалгах нь давхардал. Сервер хоорондын дуудлагад нууц
     * хуваалцах нь хангалттай бөгөөд провайдер бүрд SDK нэмэхгүй.
     *
     * ⚠️ `timingSafeEqual` — энгийн `!==` нь тэмдэгт бүрээр эрт зогсдог
     * тул нууцыг таамаглах цагийн халдлага (timing attack) боломжтой.
     */
    const expected = this.config.get<string>('auth.oauthSharedSecret');
    if (!expected) {
      /* ⚠️ Нууц тохируулаагүй бол ХААНА — задгай үлдээхээс нэвтрэлт
         унасан нь ДЭЭР (админ .env-д нэмбэл шууд сэргэнэ). */
      throw new UnauthorizedException('OAuth тохиргоо дутуу байна');
    }
    const got = Buffer.from(sharedSecret ?? '');
    const want = Buffer.from(expected);
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      throw new UnauthorizedException('Зөвшөөрөлгүй хүсэлт');
    }

    const isGoogle = dto.provider === 'google';
    const email = dto.email?.toLowerCase().trim();
    const providerEnum: 'GOOGLE' | 'FACEBOOK' = isGoogle ? 'GOOGLE' : 'FACEBOOK';

    let user = isGoogle
      ? await this.prisma.user.findUnique({ where: { googleId: dto.providerAccountId } })
      : await this.prisma.user.findUnique({ where: { facebookId: dto.providerAccountId } });

    if (!user && email) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    if (user) {
      // Одоо байгаа хэрэглэгчийг OAuth провайдертай холбоно, хоосон
      // талбаруудыг (нэр, зураг) л дүүргэнэ — гараар зассан утгыг дарахгүй.
      const avatarKey = dto.image && !user.avatarKey
        ? await this.mirrorAvatarToR2(dto.image)
        : undefined;
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(isGoogle ? { googleId: dto.providerAccountId } : { facebookId: dto.providerAccountId }),
          provider: user.provider === 'LOCAL' ? providerEnum : undefined,
          name: user.name ?? dto.name?.trim(),
          emailVerified: true,
          ...(avatarKey ? { avatarKey } : {}),
        },
      });
    } else {
      const avatarKey = dto.image ? await this.mirrorAvatarToR2(dto.image) : null;
      user = await this.prisma.user.create({
        data: {
          email: email ?? `oauth_${dto.provider}_${dto.providerAccountId}@noemail.besttv.mn`,
          name: dto.name?.trim() || null,
          provider: providerEnum,
          ...(isGoogle ? { googleId: dto.providerAccountId } : { facebookId: dto.providerAccountId }),
          emailVerified: true,
          avatarKey,
        },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Таны бүртгэл хаагдсан байна');
    }

    await this.tracking.audit(user.id, 'oauth_login', { newValue: providerEnum });
    return this.buildAuthResult(user, ctx);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, avatarKey: true, email: true, passwordHash: true },
    });
    if (!before) throw new UnauthorizedException();

    // ── Имэйл солих (нууц үгээр баталгаажна) ────────────────────────────
    let nextEmail: string | undefined;
    const wantEmail = dto.email?.toLowerCase().trim();
    if (wantEmail && wantEmail !== before.email) {
      // ⚠️ Нууц үг ЗААВАЛ — нээлттэй үлдсэн session-ээр бүртгэл булаахаас сэргийлнэ
      if (!before.passwordHash) {
        throw new BadRequestException(
          'Сошиал хаягаар нэвтэрсэн бүртгэлийн имэйлийг солих боломжгүй',
        );
      }
      if (!dto.currentPassword) {
        throw new BadRequestException('Имэйл солихын тулд одоогийн нууц үгээ оруулна уу');
      }
      const ok = await bcrypt.compare(dto.currentPassword, before.passwordHash);
      if (!ok) throw new UnauthorizedException('Нууц үг буруу байна');

      const taken = await this.prisma.user.findUnique({ where: { email: wantEmail } });
      if (taken) throw new ConflictException('Энэ имэйл өөр бүртгэлд ашиглагдсан байна');

      nextEmail = wantEmail;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
        ...(dto.avatarKey !== undefined ? { avatarKey: dto.avatarKey } : {}),
        ...(nextEmail ? { email: nextEmail, emailVerified: false } : {}),
      },
    });

    if (nextEmail) {
      await this.tracking.audit(userId, 'email', {
        oldValue: before.email,
        newValue: nextEmail,
      });
    }

    if (dto.name !== undefined && before?.name !== user.name) {
      await this.tracking.audit(userId, 'name', {
        oldValue: before?.name ?? null,
        newValue: user.name,
      });
    }
    if (dto.avatarKey !== undefined && before?.avatarKey !== user.avatarKey) {
      await this.tracking.audit(userId, 'avatar');
    }
    return this.me(user.id);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Энэ бүртгэлд нууц үг тохируулаагүй байна');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Одоогийн нууц үг буруу байна');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    /**
     * ⚠️⚠️ БҮХ SESSION-ыг ХҮЧИНГҮЙ БОЛГОНО (өөрийнхийг ч оруулаад).
     *
     * Хүн нууц үгээ солих гол шалтгаан нь «хэн нэгэн мэдчихсэн байх»
     * гэсэн сэжиг. Хуучин session-ууд амьд үлдвэл яг тэр халдлагч
     * үргэлжлүүлэн ордог тул солих үйлдэл утгагүй болно.
     *
     * ⚠️ Одоогийн төхөөрөмжийг ялгаж үлдээх БОЛОМЖГҮЙ: session нь
     * REFRESH токеноор хадгалагддаг, харин энэ endpoint-д ирдэг нь
     * ACCESS токен — хоёр өөр утга. Тиймээс бүгдийг устгаад дахин
     * нэвтрүүлнэ. Frontend `requiresRelogin`-ыг хараад хэрэглэгчид
     * ЯАГААД гарч байгааг тайлбарлана.
     */
    const revoked = await this.sessions.revokeOthers(userId, null);
    if (revoked > 0) {
      this.logger.log(`Нууц үг солив — ${revoked} session хүчингүй болов (${user.email})`);
    }

    await this.tracking.audit(userId, 'password');
    this.email.sendPasswordChanged({ to: user.email, name: user.name, userId });
    return { ok: true, requiresRelogin: true };
  }

  // ─── Нууц үг сэргээх (forgot / reset) ───────────────────────────────────────

  /**
   * Сэргээх линк илгээх.
   *
   * ⚠️⚠️ ХЭРЭГЛЭГЧ БАЙГАА ЭСЭХИЙГ ХЭЗЭЭ Ч БҮҮ ЗАДРУУЛ.
   *
   * "Ийм имэйл олдсонгүй" гэж хэлбэл халдлагч энэ endpoint-ыг жагсаалттай
   * имэйлээр дараалан дуудаж, МАНАЙ хэрэглэгч ХЭН БЭ гэдгийг бүрэн
   * тоочино (user enumeration). Тэр жагсаалт нь дараа нь фишинг,
   * credential-stuffing халдлагад шууд ашиглагдана.
   *
   * Тиймээс ДООРХ БҮХ тохиолдолд ЯГ ИЖИЛ хариу буцна:
   *   • имэйл огт бүртгэлгүй
   *   • бүртгэлтэй, линк илгээгдсэн
   *   • OAuth (Google/Facebook) бүртгэл — нууц үг байхгүй тул илгээхгүй
   *   • бүртгэл хаагдсан (isActive=false)
   *   • suppression-д орсон хаяг (SES bounce)
   */
  async forgotPassword(
    email: string,
    meta: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<{ ok: true; message: string }> {
    /* ⚠️ Энэ хариуг БҮХ салбарт ИЖИЛХЭН буцаана — доорх `return`-ууд
       ялгаатай байвал халдлагч ялгааг хараад л enumeration хийнэ. */
    const SAME_RESPONSE = {
      ok: true as const,
      message: 'Хэрэв энэ имэйл бүртгэлтэй бол сэргээх линк илгээгдлээ.',
    };

    const mail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: mail } });

    /**
     * Илгээхгүй тохиолдлууд — гэхдээ хариу ИЖИЛ:
     *   • `!user`         — бүртгэлгүй
     *   • `!passwordHash` — Google/Facebook-аар бүртгүүлсэн. Нууц үг
     *     ОГТ БАЙХГҮЙ тул "сэргээх" утгагүй. Мөн энд нууц үг ҮҮСГЭЖ
     *     болохгүй: имэйл эзэмшигч нь OAuth эзэмшигчтэй ижил гэдэг нь
     *     баталгаагүй тул шинэ нэвтрэх зам нээх нь эрсдэлтэй.
     *   • `!isActive`     — хаагдсан бүртгэл дахин нээгдэх ёсгүй
     *   • `isGuest`       — зочин бүртгэл нэвтрэх боломжгүй болсон
     */
    if (!user || !user.passwordHash || !user.isActive || user.isGuest) {
      return SAME_RESPONSE;
    }

    /**
     * ⚠️ Хуучин идэвхтэй токенуудыг УСТГАНА — нэг хэрэглэгчид нэг л
     * идэвхтэй линк. Эс бөгөөс хэрэглэгч 10 удаа дарахад 10 хүчинтэй
     * линк үлдэж, аль нэг нь задарвал (дамжуулсан имэйл, лог) удаан
     * хугацаанд ашиглагдах цонх нээгдэнэ.
     */
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // ⚠️ 32 байт (256 бит) — таамаглах боломжгүй. `Math.random()` ХЭЗЭЭ Ч БОЛОХГҮЙ.
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashResetToken(token),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    const siteUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://besttv.us';
    const resetUrl = `${siteUrl}/reset-password?token=${token}`;

    /**
     * ⚠️ Имэйл илгээлт амжилтгүй болсныг ч ХЭРЭГЛЭГЧИД ХЭЛЭХГҮЙ —
     * "илгээж чадсангүй" гэсэн хариу нь "энэ имэйл БҮРТГЭЛТЭЙ" гэдгийг
     * шууд баталчихна (бүртгэлгүй имэйлд бид огт илгээхийг оролддоггүй).
     * Алдааг зөвхөн лог + EmailLog-д үлдээнэ (админ хянана).
     */
    const sent = await this.email
      .sendPasswordReset({
        to: mail,
        resetUrl,
        name: user.name,
        expiresMinutes: RESET_TTL_MS / 60_000,
        userId: user.id,
      })
      .catch(() => false);
    if (!sent) {
      this.logger.error(`Нууц үг сэргээх имэйл илгээгдсэнгүй: ${mail}`);
    }

    await this.tracking.audit(user.id, 'password_reset_request', { ip: meta.ip });
    return SAME_RESPONSE;
  }

  /**
   * Токеноор нууц үг солих.
   *
   * ⚠️ Токен ХЭШЛЭЖ хадгалагдсан тул ирсэн утгыг хэшлээд хайна —
   * DB-д түүхий токен ХЭЗЭЭ Ч байхгүй.
   */
  async resetPassword(
    token: string,
    newPassword: string,
    meta: { ip?: string | null } = {},
  ): Promise<{ ok: true }> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashResetToken(token) },
      include: { user: true },
    });

    /* ⚠️ Хугацаа дууссан/олдоогүй хоёрт ИЖИЛ мессеж — токен бодитоор
       байсан эсэхийг ялгаж мэдэх нь халдлагчид хэрэгтэй мэдээлэл. */
    if (!row || row.expiresAt < new Date()) {
      // Хугацаа дууссан бол шууд цэвэрлэнэ (хог хуримтлагдахгүй)
      if (row) {
        await this.prisma.passwordResetToken.delete({ where: { id: row.id } }).catch(() => null);
      }
      throw new BadRequestException(
        'Линк хүчингүй эсвэл хугацаа нь дууссан байна. Дахин хүсэлт илгээнэ үү.',
      );
    }

    const user = row.user;
    if (!user.isActive || user.isGuest) {
      throw new BadRequestException('Энэ бүртгэлээр нэвтрэх боломжгүй байна');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    /**
     * ⚠️ Нэг гүйлгээнд — нууц үг солих БОЛОН токен устгах хоёрын хооронд
     * алдаа гарвал токен хүчинтэй үлдэж, ДАХИН ашиглагдах боломжтой
     * болно (нэг удаагийн баталгаа алдагдана).
     */
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          /* ⚠️ Сэргээх линкийг зөвхөн имэйлийн ЖИНХЭНЭ эзэн авч чадна —
             тиймээс энэ нь имэйл эзэмшлийн баталгаа болно. */
          emailVerified: true,
        },
      }),
      // Тухайн хэрэглэгчийн БҮХ токен (энэ болон бусад) устана
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);

    /**
     * ⚠️⚠️ БҮХ SESSION-ыг ХҮЧИНГҮЙ БОЛГОНО.
     *
     * Нууц үг сэргээх гол шалтгаан нь ихэвчлэн "бүртгэл булаагдсан".
     * Хэрэв халдлагчийн refresh token амьд үлдвэл жинхэнэ эзэн нь нууц
     * үгээ сольсон ч халдлагч 30 хоног үргэлжлүүлэн ордог — сэргээх
     * үйлдлийн ГОЛ УТГА алдагдана.
     *
     * ⚠️ `currentToken = null` — «бусад» биш, ЯГ БҮГД. Сэргээх урсгал
     * нь нэвтрээгүй хэрэглэгчээс ирдэг тул хамгаалах "одоогийн" session
     * гэж байхгүй. Бүгдийг устгаад дахин нэвтрүүлэх нь зөв.
     *
     * Устсаны дараа refresh хийхэд `sessions.touch` нь session олохгүй
     * тул `false` буцаана → хуучин БҮХ төхөөрөмж гарна.
     */
    const revoked = await this.sessions.revokeOthers(user.id, null);
    if (revoked > 0) {
      this.logger.log(`Нууц үг сэргээв — ${revoked} session хүчингүй болов (${user.email})`);
    }

    await this.tracking.audit(user.id, 'password', {
      newValue: 'reset',
      actor: 'self',
      ip: meta.ip,
    });
    this.email.sendPasswordChanged({ to: user.email, name: user.name, userId: user.id });

    return { ok: true };
  }

  /**
   * ⚠️ SHA-256 (bcrypt БИШ) — сэргээх токен нь 256 бит САНАМСАРГҮЙ утга
   * тул brute-force боломжгүй, удаан хэш хэрэггүй. Мөн bcrypt-ийн хэш нь
   * давс (salt) агуулдаг тул НЭГ утга ХЭД ХЭДЭН хэш өгдөг → `WHERE
   * tokenHash = ?` гэж индексээр хайх БОЛОМЖГҮЙ болно (бүх мөрийг
   * гүйлгэж compare хийх шаардлагатай болно).
   */
  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Google/Facebook profile зургийг R2 руу татаж хадгална — гадны CDN
   * (googleusercontent.com г.м.) URL шууд хадгалахгүй, учир нь: 1) хугацаа
   * дуусаж болзошгүй 2) манай private bucket-тэй нийцэхгүй 3) хэрэглэгч
   * авсаар CDN-ээс шууд ачаалагдвал privacy risk багатай ч найдваргүй.
   */
  private async mirrorAvatarToR2(imageUrl: string): Promise<string | null> {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());

      const sharp = (await import('sharp')).default;
      const webp = await sharp(buf)
        .resize({ width: 256, height: 256, fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      const key = `avatars/${randomUUID()}.webp`;
      await this.storage.upload(key, webp, 'image/webp');
      return key;
    } catch (err) {
      this.logger.warn(`OAuth avatar mirror амжилтгүй: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * ⚠️⚠️ ASYNC болов — session бүртгэх шаардлагатай.
   *
   * `ctx` (User-Agent/IP) нь controller-оос ирнэ. Байхгүй бол session
   * нь «Тодорхойгүй төхөөрөмж» гэж бүртгэгдэнэ — хязгаар ажилласаар
   * байна (нэр нь л ойлгомжгүй).
   */
  private async buildAuthResult(user: User, ctx: DeviceContext = {}): Promise<AuthResult> {
    const tokens = this.signTokens(user);

    /* ⚠️ Хязгаар хэтэрвэл хамгийн удаан идэвхгүйг гаргана */
    const { evicted } = await this.sessions.create(
      user.id,
      tokens.refreshToken,
      ctx,
      this.refreshExpiryDate(),
      /* ⚠️ Админ хязгааргүй — дэлгэрэнгүйг `SessionService.create` дээр */
      user.role === Role.ADMIN,
    );
    if (evicted) {
      this.logger.log(`Төхөөрөмжийн хязгаар: "${evicted}" гарлаа (user=${user.id})`);
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: null, // login/register/oauth хариунд presign хийхгүй (жижиг optimization) — /me дуудахад бэлэн болно
        isGuest: user.isGuest,
      },
    };
  }

  /**
   * Refresh token хэзээ дуусахыг Date болгож тооцно.
   * ⚠️ `jwt.refreshExpiresIn` нь '30d' хэлбэртэй — DB-д Date хэрэгтэй.
   */
  private refreshExpiryDate(): Date {
    const raw = this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const m = /^(\d+)([smhd])$/.exec(raw.trim());
    const mult = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 } as const;
    const ms = m ? Number(m[1]) * mult[m[2] as keyof typeof mult] : 30 * 86400e3;
    return new Date(Date.now() + ms);
  }

  private signTokens(user: User): AuthTokens {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn = this.config.get<string>('jwt.expiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    return {
      accessToken: this.jwt.sign(payload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn,
      }),
      /**
       * ⚠️⚠️ `jti` (санамсаргүй ID) ЗААВАЛ — эс бөгөөс ХОЁР ТӨХӨӨРӨМЖ
       * НЭГ ТОКЕН хуваалцана.
       *
       * JWT-ийн `iat` нь СЕКУНДЫН нарийвчлалтай тул нэг хэрэглэгч нэг
       * секундэд хоёр удаа нэвтэрвэл payload ЯГ ИЖИЛ болж, гарын үсэг
       * нь ч ижил гарна. Үр дүнд:
       *   • `UserSession.tokenHash` unique зөрчигдөж 2 дахь session
       *     бүртгэгдэхгүй → төхөөрөмжийн хязгаар ажиллахгүй
       *   • Нэг төхөөрөмжийг гаргахад НӨГӨӨ нь ч гарна (нэг мөр)
       * Production дээр бодитоор илэрсэн (тест 11/16).
       */
      refreshToken: this.jwt.sign(
        { sub: user.id, jti: randomUUID() },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: refreshExpiresIn,
        },
      ),
    };
  }
}
