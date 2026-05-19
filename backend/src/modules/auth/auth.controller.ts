import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ValidateDto } from './dto/validate.dto';
import { OAuthDto } from './dto/oauth.dto';

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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
}
