import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { PhoneVerifyService } from './phone-verify.service';
import { VerifyMnService } from './verify-mn.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SessionService, PhoneVerifyService, VerifyMnService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
