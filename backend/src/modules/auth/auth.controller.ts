import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
