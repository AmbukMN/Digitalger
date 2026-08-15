import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SessionService, type DeviceContext } from './session.service';
import { PhoneVerifyService } from './phone-verify.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestPhoneVerifyDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { OAuthLoginDto } from './dto/oauth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../storage/storage.service';

const AVATAR_SIZE_LIMIT = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * verify.mn callback-ийн source IP.
 * ⚠️ Баримтжуулсан хаягууд — өөрчлөгдвөл callback ажиллахаа болино
 * (гэхдээ polling нь ямар ч тохиолдолд баталгаажуулах тул эгзэгтэй биш).
 */
const VERIFY_MN_CALLBACK_IPS = new Set(['3.34.8.248', '13.124.219.192']);

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly storage: StorageService,
    private readonly sessions: SessionService,
    private readonly phoneVerify: PhoneVerifyService,
  ) {}

  /**
   * Хүсэлтээс төхөөрөмжийн мэдээлэл гаргана.
   *
   * ⚠️ Nginx ард ажилладаг тул `req.ip` нь proxy-ийн IP байж мэднэ —
   * `trust proxy` тохируулсан үед л бодит IP ирнэ. IP нь зөвхөн
   * ЧИГЛҮҮЛЭХ мэдээлэл (хэрэглэгч төхөөрөмжөө таних), эрх шалгахад
   * ХЭРЭГЛЭХГҮЙ тул буруу байсан ч аюулгүй.
   */
  private device(req: Request): DeviceContext {
    /**
     * ⚠️⚠️ CLOUDFLARE-ЫН АРД — `req.ip` нь CF-ийн дамжуулагч сервер
     * (172.69.x.x) болно, хэрэглэгчийн IP БИШ. Хэрэглэгч жагсаалтад
     * «172.69.252.190» гэж хараад өөрийн төхөөрөмжөө таних боломжгүй.
     *
     * `CF-Connecting-IP` нь Cloudflare-ийн НЭМДЭГ header — гаднаас
     * хуурамчаар илгээсэн ч CF нь дарж бичдэг тул найдвартай.
     * ⚠️ IP нь зөвхөн ХАРУУЛАХ зорилготой (эрх шалгахад хэрэглэхгүй).
     */
    const cf = req.headers['cf-connecting-ip'];
    const fwd = req.headers['x-forwarded-for'];
    const ip =
      (typeof cf === 'string' ? cf : null) ??
      (typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : null) ??
      req.ip ??
      null;
    return { userAgent: req.headers['user-agent'] ?? null, ip };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.device(req));
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.device(req));
  }

  @Post('admin/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  adminLogin(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.adminLogin(dto, this.device(req));
  }

  /** NextAuth (frontend) OAuth signIn callback-аас дуудагдана */
  @Post('oauth')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  oauth(
    @Body() dto: OAuthLoginDto,
    /**
     * ⚠️⚠️ ХУВААЛЦСАН НУУЦ — энэ header БАЙХГҮЙ бол хүсэлт татгалзана.
     *
     * Энэ endpoint нь имэйлээр хэрэглэгч олоод ТҮҮНИЙ токеныг буцаадаг
     * тул баталгаажуулалтгүй бол ХЭН Ч admin@besttv.mn гэж бичээд
     * ADMIN эрх авна (production дээр бодитоор тестлэж баталсан).
     * Зөвхөн манай Next.js СЕРВЕР дууддаг тул browser-т нууц задрахгүй.
     */
    @Headers('x-oauth-secret') secret: string | undefined,
    @Req() req: Request,
  ) {
    return this.auth.oauthLogin(dto, secret, this.device(req));
  }

  // ⚠️ Зочноор нэвтрэх (/auth/guest) болон convert-guest ХАСАГДСАН.
  // Зөвхөн имэйл+нууц үг, Google, Facebook-ээр л нэвтэрнэ.

  /**
   * ⚠️ Throttle — дуудалт бүрт `jwt.verify` + DB унших ажил хийдэг.
   * Мөн refresh token нь 30 хоног хүчинтэй бөгөөд revoke хийх
   * механизм байхгүй тул энэ endpoint-ыг нягт хянах шаардлагатай.
   * Хэвийн клиент 15 минутад нэг л дуудна — 30/мин элбэг хангалттай.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.device(req));
  }

  /**
   * ─── ТӨХӨӨРӨМЖИЙН УДИРДЛАГА ───────────────────────────────────────
   *
   * ⚠️ Нэг эрхээр дээд тал нь MAX_DEVICES төхөөрөмж нэвтэрнэ.
   * Хэрэглэгч профайл/багц хэсгээсээ жагсаалтыг хараад хэрэггүйг нь
   * гаргаж чадна.
   *
   * ⚠️ `refreshToken` нь СОНГОМОЛ — байвал «энэ төхөөрөмж» гэж
   * тэмдэглэнэ (хэрэглэгч өөрийгөө андуурч гаргахгүй).
   */
  /**
   * Гарах — энэ төхөөрөмжийн session-ыг УСТГАНА.
   *
   * ⚠️⚠️ ЗААВАЛ ХЭРЭГТЭЙ: клиент зөвхөн localStorage цэвэрлэвэл DB-д
   * мөр 30 хоног үлдэж ХЯЗГААРЫН БАЙРЫГ дэмий эзэлнэ. Хэрэглэгч
   * гараад дахин орох тусам байр дүүрч, эцэст нь бодит төхөөрөмжөө
   * гаргах болно — «2 төхөөрөмж» гэж зарласан атлаа 1 л ажиллана.
   *
   * ⚠️ Guard ТАВИХГҮЙ — access token нь аль хэдийн хугацаа дууссан
   * байхад ч гарах ёстой. refresh token-ы хэшээр л мөр олно (өөрийн
   * токеноо мэдэхгүй хүн бусдын session устгаж чадахгүй).
   */
  @Post('logout')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  async logout(@Body() body: { refreshToken?: string }) {
    if (body?.refreshToken) await this.sessions.revokeByToken(body.refreshToken);
    return { ok: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: JwtPayload, @Query('rt') rt?: string) {
    return this.sessions.list(user.sub, rt ?? null);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async revokeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const ok = await this.sessions.revoke(user.sub, id);
    if (!ok) throw new BadRequestException('Төхөөрөмж олдсонгүй');
    return { ok: true };
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async revokeOtherSessions(@CurrentUser() user: JwtPayload, @Body() body: { refreshToken?: string }) {
    const count = await this.sessions.revokeOthers(user.sub, body?.refreshToken ?? null);
    return { ok: true, count };
  }

  /**
   * Нууц үг сэргээх линк хүсэх.
   *
   * ⚠️⚠️ THROTTLE ЗААВАЛ (5 хүсэлт / 5 минут) — хоёр шалтгаан:
   *   1. ИМЭЙЛ ҮЕР — халдлагч нэг хүний хаяг руу мянган линк илгээж
   *      хайрцгийг нь боох боломжтой (mail bomb). Мөн манай SES-ийн
   *      reputation унаж, БҮХ имэйл блоклогдох эрсдэлтэй.
   *   2. ENUMERATION-ыг УДААШРУУЛНА — хариу нь ижил ч бөгөөд халдлагч
   *      их хэмжээгээр туршихыг хязгаарлана.
   */
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto.email, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  /**
   * Линкийн токеноор шинэ нууц үг тавих.
   * ⚠️ Throttle — токеныг таамаглах оролдлогыг хязгаарлана (256 бит тул
   * практикт боломжгүй ч гэсэн хамгаалалтын давхарга).
   */
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto.token, dto.password, { ip: req.ip ?? null });
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

  /** Хэрэглэгч өөрийн профайл зураг upload хийнэ (admin эрхгүйгээр) */
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: AVATAR_SIZE_LIMIT } }))
  async uploadAvatar(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Зөвшөөрөгдөөгүй зургийн төрөл: ${file.mimetype}`);
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

  // ═══ УТАС БАТАЛГААЖУУЛАЛТ (verify.mn MO SMS) ═══════════════════════════

  /**
   * Баталгаажуулах хүсэлт — 144773 руу илгээх код + заавар буцаана.
   * ⚠️ Rate limit чанга — session бүр verify.mn-д ЗАРДАЛТАЙ.
   */
  @Post('request-phone-verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestPhoneVerify(@CurrentUser() user: JwtPayload, @Body() dto: RequestPhoneVerifyDto) {
    return this.phoneVerify.requestPhoneVerify(user.sub, dto.phone);
  }

  /**
   * Polling — session-ий төлөв.
   * ⚠️ Frontend 3 секунд тутам дуудна (verify.mn 2с дотор 429 буцаана).
   */
  @Get('phone-verify/status')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  phoneVerifyStatus(@CurrentUser() user: JwtPayload, @Query('sessionId') sessionId: string) {
    return this.phoneVerify.getStatus(user.sub, sessionId);
  }

  /**
   * verify.mn callback — НЭЭЛТТЭЙ (JWT байхгүй, verify.mn-ээс ирнэ).
   *
   * ⚠️⚠️ Энэ нь зөвхөн «сэрээх дохио». Дуудагчийн үгэнд ИТГЭХГҮЙ —
   * `handleCallback` дотор verify.mn руу ДАХИН хүсэлт явуулж
   * баталгаажуулна. Эс бөгөөс хэн нэгэн энэ URL-ыг таамаглаж дуудаад
   * бусдын дугаарыг «баталгаажуулах» боломжтой болно.
   *
   * ⚠️ IP whitelist — verify.mn-ий баримтжуулсан source IP.
   * ⚠️ ҮРГЭЛЖ 200 буцаана (403 биш) — verify.mn дахин дуудахгүйн тулд.
   *    Polling нь ямар ч тохиолдолд баталгаажуулдаг тул эгзэгтэй биш.
   */
  @Get('phone-verify/callback')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  phoneVerifyCallback(@Query('sid') sid: string, @Req() req: Request): { ok: boolean } {
    const fwd = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    /* ⚠️ Nginx ард тул `x-forwarded-for`-ийн ЭХНИЙ IP. `::ffff:` угтварыг хасна */
    const clientIp = (fwd.split(',')[0]?.trim() || req.ip || '').replace(/^::ffff:/, '');

    if (!VERIFY_MN_CALLBACK_IPS.has(clientIp)) {
      this.logger.warn(`Phone verify callback — зөвшөөрөгдөөгүй IP: ${clientIp}`);
      return { ok: false };
    }
    /* ⚠️ Хүлээхгүй — verify.mn-д 200-г ХУРДАН буцаана */
    void this.phoneVerify.handleCallback(sid);
    return { ok: true };
  }
}
