import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { OAuthLoginDto } from './dto/oauth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../storage/storage.service';

const AVATAR_SIZE_LIMIT = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly storage: StorageService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('admin/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  adminLogin(@Body() dto: LoginDto) {
    return this.auth.adminLogin(dto);
  }

  /** NextAuth (frontend) OAuth signIn callback-аас дуудагдана */
  @Post('oauth')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  oauth(@Body() dto: OAuthLoginDto) {
    return this.auth.oauthLogin(dto);
  }

  // ⚠️ Зочноор нэвтрэх (/auth/guest) болон convert-guest ХАСАГДСАН.
  // Зөвхөн имэйл+нууц үг, Google, Facebook-ээр л нэвтэрнэ.

  /** ⚠️ ТҮР ОНОШЛОГОО — асуудал ШИЙДЭГДСЭНИЙ ДАРАА л устгана */
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    let sub = '?';
    try {
      sub = (
        JSON.parse(
          Buffer.from(dto.refreshToken.split('.')[1], 'base64').toString('utf8'),
        ) as { sub?: string }
      ).sub!;
    } catch {
      /* задарсангүй */
    }
    try {
      const r = await this.auth.refresh(dto.refreshToken);
      // eslint-disable-next-line no-console
      console.warn(`[DIAG-REFRESH] ✅ АМЖИЛТТАЙ sub=${sub}`);
      return r;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[DIAG-REFRESH] ❌ УНАСАН sub=${sub} — ${(e as Error).message}`);
      throw e;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto);
  }

  /** Хэрэглэгч өөрийн профайл зураг upload хийнэ (admin эрхгvйгээр) */
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: AVATAR_SIZE_LIMIT } }))
  async uploadAvatar(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Зөвшөөрөгдөөгvй зургийн төрөл: ${file.mimetype}`);
    }

    const sharp = (await import('sharp')).default;
    const buf = await sharp(file.buffer)
      .resize({ width: 256, height: 256, fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const key = this.storage.buildKey('avatars', 'avatar.webp');
    await this.storage.upload(key, buf, 'image/webp');
    return this.auth.updateProfile(user.sub, { avatarKey: key });
  }
}
