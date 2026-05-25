import { IsEmail, IsIn, IsString, Length, MinLength } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  email: string;

  @IsIn(['verify', 'reset'])
  purpose: 'verify' | 'reset';
}

export class VerifySignupOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}

export class VerifyEmailOtpDto {
  @IsString()
  @Length(6, 6)
  otp: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
