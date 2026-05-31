import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Профайл шинэчлэх DTO (PATCH /users/me).
 * ⚠️ email-ийг энд хүлээж авдаг ч updateMe нь түүгээр email СОЛИХГҮЙ —
 * имэйл солих нь зөвхөн /auth/request-email-change flow-р явна.
 */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байх ёстой' })
  @MaxLength(60, { message: 'Нэр хэт урт байна' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Утасны дугаар буруу байна (8-15 орон)' })
  phone?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Зөв имэйл оруулна уу' })
  email?: string;
}

export class UpdatePasswordDto {
  @IsOptional()
  @IsEmail({}, { message: 'Зөв имэйл оруулна уу' })
  email?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгт' })
  newPassword: string;
}
