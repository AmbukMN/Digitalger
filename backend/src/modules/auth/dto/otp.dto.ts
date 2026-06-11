import { IsEmail, IsIn, IsString, Length, Matches, MinLength } from 'class-validator';

// Утас баталгаажуулах хүсэлт (verify.mn MO SMS). 8-15 орон, заавал + байж болно.
export class RequestPhoneVerifyDto {
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Утасны дугаар буруу байна' })
  phone: string;
}

export class SendOtpDto {
  @IsEmail()
  email: string;

  @IsIn(['verify', 'reset', 'email_change'])
  purpose: 'verify' | 'reset' | 'email_change';
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
