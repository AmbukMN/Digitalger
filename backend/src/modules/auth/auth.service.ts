import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidateDto } from './dto/validate.dto';
import { OAuthDto } from './dto/oauth.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { EmailService } from '../notifications/email.service';

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENT_PER_HOUR = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  image: string | null;
  phone: string | null;
  isGuest: boolean;
  oauthProvider: string | null;
  emailVerified: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email.toLowerCase() },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existing) {
      if (existing.email === dto.email.toLowerCase()) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Phone already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        phone: dto.phone,
        passwordHash,
      },
    });

    // Send verification OTP — don't auto-login
    await this.createAndSendOtp(user.email, user.name, 'verify');

    return { message: 'OTP sent', email: user.email };
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone && !dto.userId) {
      throw new UnauthorizedException('Email, phone, or userId required');
    }

    const user = await this.prisma.user.findFirst({
      where: dto.userId
        ? { id: dto.userId }
        : dto.email
          ? { email: dto.email.toLowerCase() }
          : { phone: dto.phone },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async oauthLogin(dto: OAuthDto) {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (account) {
      const updated = await this.prisma.user.update({
        where: { id: account.userId },
        data: {
          ...(dto.name && !account.user.name && { name: dto.name }),
          ...(dto.image && !account.user.image && { image: dto.image }),
        },
      });
      const tokens = await this.issueTokens(updated.id, updated.email, updated.role);
      await this.saveRefreshToken(updated.id, tokens.refreshToken);
      return { user: this.sanitizeUser(updated), ...tokens };
    }

    let user = dto.email
      ? await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })
      : null;

    if (!user) {
      const email = dto.email?.toLowerCase() ?? `oauth_${dto.provider}_${dto.providerAccountId}@noemail.digitalger.mn`;
      user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name ?? null,
          image: dto.image ?? null,
          oauthProvider: dto.provider,
          oauthId: dto.providerAccountId,
          emailVerified: dto.email ? new Date() : null,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          oauthProvider: user.oauthProvider ?? dto.provider,
          oauthId: user.oauthId ?? dto.providerAccountId,
          ...(dto.image && !user.image && { image: dto.image }),
          ...(dto.name && !user.name && { name: dto.name }),
          emailVerified: user.emailVerified ?? new Date(),
        },
      });
    }

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      },
      create: {
        userId: user.id,
        type: 'oauth',
        provider: dto.provider,
        providerAccountId: dto.providerAccountId,
      },
      update: {},
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user?.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async guestLogin() {
    const uid = Math.random().toString(36).slice(2, 10);
    const email = `guest_${uid}@guest.digitalger.mn`;
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email, name: 'Зочин', passwordHash, isGuest: true },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens, tempEmail: email, tempPassword };
  }

  /** Send OTP for email verification (for already logged-in users) */
  async sendVerifyOtp(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }
    await this.createAndSendOtp(user.email, user.name, 'verify');
    return { message: 'OTP sent' };
  }

  /** Verify email OTP (logged-in user) */
  async verifyEmailOtp(userId: string, otp: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.consumeOtp(user.email, otp, 'verify');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    return { message: 'Email verified' };
  }

  /**
   * Имэйл солих хүсэлт — ШИНЭ имэйл рүү OTP илгээнэ.
   * ⚠️ User.email-ийг ОДОО СОЛИХГҮЙ — зөвхөн pendingEmail-д хадгална.
   * Баталгаажсаны дараа л confirmEmailChange-д солигдоно.
   */
  async requestEmailChange(userId: string, newEmail: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // OAuth бүртгэлд имэйл солих боломжгүй
    if (user.oauthProvider && !user.isGuest) {
      throw new BadRequestException('OAuth бүртгэлд имэйл солих боломжгүй');
    }

    const normalizedEmail = newEmail.toLowerCase();

    // Одоогийнхтойгоо ижил бол утгагүй
    if (normalizedEmail === user.email.toLowerCase()) {
      throw new BadRequestException('Энэ нь таны одоогийн имэйл байна');
    }

    // Өөр хэрэглэгч эзэмшсэн эсэх
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }

    // Шинэ имэйлийг түр хадгална (User.email-д хүрэхгүй)
    await this.prisma.user.update({
      where: { id: userId },
      data: { pendingEmail: normalizedEmail },
    });

    // OTP-г ШИНЭ имэйл рүү илгээнэ (email_change purpose)
    await this.createAndSendOtp(normalizedEmail, user.name, 'email_change');
    return { message: 'OTP sent to new email' };
  }

  /**
   * Имэйл солих баталгаажуулалт — OTP зөв бол User.email = pendingEmail болно.
   * Зөвхөн ЭНД л имэйл бодитоор солигдоно.
   */
  async confirmEmailChange(userId: string, otp: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.pendingEmail) {
      throw new BadRequestException('Хүлээгдэж буй имэйл солих хүсэлт алга');
    }
    const pending = user.pendingEmail.toLowerCase();

    // Давхар шалгалт (хооронд нь өөр хэн нэгэн авсан байж болзошгүй)
    const existing = await this.prisma.user.findUnique({ where: { email: pending } });
    if (existing && existing.id !== userId) {
      // pending-ийг цэвэрлээд татгалзана
      await this.prisma.user.update({ where: { id: userId }, data: { pendingEmail: null } });
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }

    // OTP-г ШИНЭ имэйлээр баталгаажуулна
    await this.consumeOtp(pending, otp, 'email_change');

    const prevEmail = user.email;

    // Зөвхөн ОДОО л имэйл солигдоно — баталгаажсан тул emailVerified тавина
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: pending,
        pendingEmail: null,
        isGuest: false,
        emailVerified: new Date(),
      },
    });

    // Имэйл солисон түүх (хэрэглэгч өөрөө, баталгаажсан) — fire-and-forget
    this.prisma.userAuditLog
      .create({
        data: { userId, field: 'email', oldValue: prevEmail, newValue: pending, actor: 'self' },
      })
      .catch(() => {});

    return { message: 'Email changed', user: this.sanitizeUser(updated) };
  }

  /** Verify OTP after signup (unauthenticated — returns tokens on success) */
  async verifySignupOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase();
    await this.consumeOtp(normalizedEmail, otp, 'verify');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { email: normalizedEmail } });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /** Resend OTP (signup verify, password reset, болон имэйл солих) */
  async resendOtp(email: string, purpose: 'verify' | 'reset' | 'email_change') {
    const normalizedEmail = email.toLowerCase();

    // For verify: check user exists; for reset: check user exists
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new BadRequestException('User not found');

    const existing = await this.prisma.emailOtp.findFirst({
      where: { email: normalizedEmail, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const secondsSinceSent = (Date.now() - existing.lastSentAt.getTime()) / 1000;
      if (secondsSinceSent < OTP_RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceSent);
        throw new BadRequestException(`Please wait ${wait} seconds before resending`);
      }

      const hourAgo = new Date(Date.now() - 3600_000);
      if (existing.sentCount >= OTP_MAX_SENT_PER_HOUR && existing.lastSentAt > hourAgo) {
        throw new BadRequestException('Too many OTP requests. Try again in an hour.');
      }
    }

    await this.createAndSendOtp(normalizedEmail, user.name, purpose);
    return { message: 'OTP resent' };
  }

  /** Forgot password: send reset OTP. Зөвхөн бүртгэлтэй (зочин/OAuth биш) хэрэглэгчид. */
  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Бүртгэлгүй имэйлд reset хийх боломжгүй — тодорхой хэлнэ
    if (!user || user.isGuest) {
      throw new BadRequestException('Энэ имэйлээр бүртгэл олдсонгүй');
    }
    // OAuth (Google г.м.)-аар нэвтэрсэн бол нууц үггүй тул reset утгагүй
    if (user.oauthProvider && !user.passwordHash) {
      throw new BadRequestException(
        'Энэ бүртгэл нийгмийн сүлжээгээр нэвтэрдэг тул нууц үг сэргээх боломжгүй',
      );
    }

    await this.createAndSendOtp(normalizedEmail, user.name, 'reset');
    return { message: 'OTP sent' };
  }

  /** Reset password with OTP */
  async resetPassword(email: string, otp: string, newPassword: string) {
    const normalizedEmail = email.toLowerCase();
    await this.consumeOtp(normalizedEmail, otp, 'reset');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash },
    });
    return { message: 'Password reset successfully' };
  }

  /** NextAuth credentials callback */
  async validate(dto: ValidateDto): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email?.toLowerCase() ?? '' },
          ...(dto.email?.includes('@') ? [] : [{ phone: dto.email }]),
        ],
      },
    });

    if (!user) return null;

    if (dto.password) {
      if (!user.passwordHash) return null;
      const valid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!valid) return null;
    }

    return this.sanitizeUser(user);
  }

  private async createAndSendOtp(
    email: string,
    name: string | null,
    purpose: 'verify' | 'reset' | 'email_change',
  ) {
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

    const existing = await this.prisma.emailOtp.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.emailOtp.upsert({
      where: { id: existing?.id ?? 'new' },
      create: {
        email,
        otpHash,
        purpose,
        expiresAt,
        sentCount: 1,
        lastSentAt: new Date(),
        attempts: 0,
      },
      update: {
        otpHash,
        expiresAt,
        attempts: 0,
        sentCount: { increment: 1 },
        lastSentAt: new Date(),
      },
    });

    await this.email.sendEmailOtp({ to: email, name, otp, purpose });
  }

  private async consumeOtp(
    email: string,
    otp: string,
    purpose: 'verify' | 'reset' | 'email_change',
  ) {
    const record = await this.prisma.emailOtp.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestException('OTP not found. Please request a new one.');
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
    }

    const valid = await bcrypt.compare(otp, record.otpHash);

    if (!valid) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = OTP_MAX_ATTEMPTS - record.attempts - 1;
      throw new BadRequestException(`Invalid OTP. ${remaining} attempts remaining.`);
    }

    // Delete OTP record after successful verification
    await this.prisma.emailOtp.delete({ where: { id: record.id } });
  }

  private async issueTokens(userId: string, email: string, role: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };
    const expiresIn = this.config.getOrThrow<string>('jwt.expiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = this.config.getOrThrow<string>('jwt.refreshExpiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        expiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    image: string | null;
    phone?: string | null;
    isGuest?: boolean;
    oauthProvider?: string | null;
    emailVerified?: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      phone: user.phone ?? null,
      isGuest: user.isGuest ?? false,
      oauthProvider: user.oauthProvider ?? null,
      emailVerified: user.emailVerified ?? null,
    };
  }
}
