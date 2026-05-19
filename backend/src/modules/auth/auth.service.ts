import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidateDto } from './dto/validate.dto';
import { OAuthDto } from './dto/oauth.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

const BCRYPT_ROUNDS = 12;

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
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
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
    // Try to find user by provider account
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
      // Update user profile from OAuth
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

    // Try to find by email
    let user = dto.email
      ? await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })
      : null;

    if (!user) {
      // Create new user from OAuth
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
      // Update existing user with OAuth info
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

    // Create Account record
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
    };
  }
}
