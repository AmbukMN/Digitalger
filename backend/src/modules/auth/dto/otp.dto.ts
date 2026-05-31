import { IsEmail, IsIn, IsString, Length, MinLength } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  email: string;

  @IsIn(['verify', 'reset'])
  purpose: 'verify' | 'reset';
}

// Имэйл солих хүсэлт — шинэ имэйл рүү OTP илгээнэ (баталгаажтал User.email солихгүй)
export class RequestEmailChangeDto {
  @IsEmail()
  email: string;
}

// Имэйл солих баталгаажуулалт — OTP зөв бол User.email шинэ имэйл болно
export class ConfirmEmailChangeDto {
  @IsString()
  @Length(6, 6)
  otp: string;
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
