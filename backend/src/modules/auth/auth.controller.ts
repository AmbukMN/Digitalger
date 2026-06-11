import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PhoneVerifyService } from './phone-verify.service';
import { RequestPhoneVerifyDto } from './dto/otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ValidateDto } from './dto/validate.dto';
import { OAuthDto } from './dto/oauth.dto';
import {
  ConfirmEmailChangeDto,
  ForgotPasswordDto,
  RequestEmailChangeDto,
  ResetPasswordDto,
  SendOtpDto,
  VerifyEmailOtpDto,
  VerifySignupOtpDto,
} from './dto/otp.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// verify.mn callback-ийн IP whitelist (баримтжуулсан source IP-ууд).
const VERIFY_MN_CALLBACK_IPS = new Set(['3.34.8.248', '13.124.219.192']);

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly phoneVerify: PhoneVerifyService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('oauth')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  oauth(@Body() dto: OAuthDto) {
    return this.authService.oauthLogin(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // brute-force/flood сэргийлэх
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('guest')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 20→5: guest user flood (DB дүүргэх) сэргийлэх
  guest() {
    return this.authService.guestLogin();
  }

  @Post('validate')
  async validate(@Body() dto: ValidateDto) {
    const user = await this.authService.validate(dto);
    if (!user) {
      return { valid: false, user: null };
    }
    return { valid: true, user };
  }

  /** Verify OTP after signup (unauthenticated) */
  @Post('verify-signup-otp')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifySignupOtp(@Body() dto: VerifySignupOtpDto) {
    return this.authService.verifySignupOtp(dto.email, dto.otp);
  }

  /** Send OTP to verify already-logged-in user's email */
  @Post('send-verify-otp')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  sendVerifyOtp(@CurrentUser() user: JwtPayload) {
    return this.authService.sendVerifyOtp(user.sub);
  }

  /** Verify email OTP (logged-in user) */
  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyEmail(@CurrentUser() user: JwtPayload, @Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(user.sub, dto.otp);
  }

  /** Имэйл солих хүсэлт — шинэ имэйл рүү OTP илгээнэ (User.email солихгүй) */
  @Post('request-email-change')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestEmailChange(@CurrentUser() user: JwtPayload, @Body() dto: RequestEmailChangeDto) {
    return this.authService.requestEmailChange(user.sub, dto.email);
  }

  /** Имэйл солих баталгаажуулалт — OTP зөв бол л User.email солигдоно */
  @Post('confirm-email-change')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirmEmailChange(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmEmailChangeDto) {
    return this.authService.confirmEmailChange(user.sub, dto.otp);
  }

  /** Resend OTP (both signup flow and logged-in verify) */
  @Post('resend-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resendOtp(@Body() dto: SendOtpDto) {
    return this.authService.resendOtp(dto.email, dto.purpose);
  }

  /** Forgot password */
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /** Reset password with OTP */
  @Post('reset-password')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  // ═══ Утас баталгаажуулалт (verify.mn MO SMS) ════════════════════════════════

  /** Утас баталгаажуулах хүсэлт — verify.mn session үүсгэж 144773 заавар буцаана */
  @Post('request-phone-verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestPhoneVerify(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestPhoneVerifyDto,
  ) {
    return this.phoneVerify.requestPhoneVerify(user.sub, dto.phone);
  }

  /** Polling — verify.mn session төлөв шалгана (VERIFIED бол User шинэчилнэ) */
  @Get('phone-verify/status')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  phoneVerifyStatus(
    @CurrentUser() user: JwtPayload,
    @Query('sessionId') sessionId: string,
  ) {
    return this.phoneVerify.getStatus(user.sub, sessionId);
  }

  /**
   * verify.mn callback (PUBLIC, guard-гүй) — body-гүй wake-up signal.
   * ⚠️ IP whitelist (verify.mn source IP) шалгана. Зөвхөн дохио тул session-ийг
   * sid-ээр олж getSessionStatus-аар ДАХИН баталгаажуулна (handleCallback дотор).
   * 200-г ХУРДАН буцаана (verify.mn 2xx хүлээдэг).
   */
  @Get('phone-verify/callback')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async phoneVerifyCallback(
    @Query('sid') sid: string,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    // ── IP whitelist (x-forwarded-for эхний IP эсвэл req.ip) ──
    const fwd = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    const clientIp = (fwd.split(',')[0]?.trim() || req.ip || '').replace(
      /^::ffff:/,
      '',
    );
    if (!VERIFY_MN_CALLBACK_IPS.has(clientIp)) {
      this.logger.warn(`Phone verify callback — зөвшөөрөгдөөгүй IP: ${clientIp}`);
      // 403 буцаахын оронд 200 чимээгүй буцаана (verify.mn дахин дуудахгүй) —
      // status polling нь ямар ч тохиолдолд баталгаажуулдаг тул critical биш.
      return { ok: false };
    }
    // Fire-and-forget — verify.mn-д 200-г хурдан буцаана.
    void this.phoneVerify.handleCallback(sid);
    return { ok: true };
  }
}
