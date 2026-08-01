import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Нууц үг доод тал нь 8 тэмдэгт байна' })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Нууц үг оруулна уу' })
  password: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatarKey?: string;

  /**
   * Имэйл солих.
   * ⚠️ Нууц үгээр баталгаажуулна (`currentPassword`) — эс бөгөөс хэн нэгэн
   * нээлттэй үлдсэн session-ээр имэйлийг солиод бүртгэлийг булааж авна.
   */
  @IsOptional()
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Одоогийн нууц үг оруулна уу' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Шинэ нууц үг доод тал нь 8 тэмдэгт байна' })
  newPassword: string;
}
