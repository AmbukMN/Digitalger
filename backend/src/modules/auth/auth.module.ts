import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PhoneVerifyService } from './phone-verify.service';
import { VerifyMnService } from './verify-mn.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { SubscribersModule } from '../subscribers/subscribers.module';

@Module({
  imports: [
    NotificationsModule,
    NotificationCenterModule,
    SubscribersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('jwt.expiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PhoneVerifyService, VerifyMnService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
