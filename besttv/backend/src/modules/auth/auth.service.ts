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
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
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
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
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

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
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
    return this.buildAuthResult(user);
  }

  /** Админ нэвтрэлт — зөвхөн ADMIN role */
  async adminLogin(dto: LoginDto): Promise<AuthResult> {
    const result = await this.login(dto);
    if (result.user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Админ эрхгүй байна');
    }
    return result;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) throw new Error();
      return this.signTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh token хүчингүй байна');
    }
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
    };
  }

  /**
   * OAuth (Google/Facebook) нэвтрэлт — frontend NextAuth-аас provider profile
   * ирнэ. Байгаа providerId-аар олно → байхгүй бол email-ээр холбоно (жишээ
   * нь эхлээд имэйлээр бүртгүүлсэн хэрэглэгч дараа Google-аар нэвтрэхэд ижил
   * акаунт руу холбогдоно) → аль нь ч биш бол шинэ хэрэглэгч үүсгэнэ.
   */
  async oauthLogin(dto: OAuthLoginDto): Promise<AuthResult> {
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
    return this.buildAuthResult(user);
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
      throw new UnauthorizedException('Энэ бүртгэлд нууц үг тохируулаагvй байна');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Одоогийн нууц үг буруу байна');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tracking.audit(userId, 'password');
    return { ok: true };
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

  private buildAuthResult(user: User): AuthResult {
    const tokens = this.signTokens(user);
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

  private signTokens(user: User): AuthTokens {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn = this.config.get<string>('jwt.expiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    return {
      accessToken: this.jwt.sign(payload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn,
      }),
      refreshToken: this.jwt.sign(
        { sub: user.id },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: refreshExpiresIn,
        },
      ),
    };
  }
}
