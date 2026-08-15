import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг доод тал нь 6 тэмдэгт байна' })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  /**
   * ⚠️ ЗААВАЛ БИШ — хэрэглэгч зөвхөн имэйлээр бүртгүүлж болно.
   * ⚠️ Regex СУЛ (зай/зураас/+976 зөвшөөрнө) — хатуу шалгалт болон
   *    нормалчлалыг `normalizePhone` хийнэ. Энд хатуу барих нь
   *    «+976 9900 1122» гэж бичсэн хүнийг шалтгаангүй татгалзана.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[+\d\s()-]{8,20}$/, { message: 'Утасны дугаар буруу байна' })
  phone?: string;
}

export class LoginDto {
  /**
   * ⚠️⚠️ ИМЭЙЛ ЭСВЭЛ УТАС — `@IsEmail` ХЭРЭГЛЭХГҮЙ.
   *
   * Нэвтрэх формд нэг л талбар байна. `@IsEmail` тавибал утсаар
   * нэвтрэх боломж DTO түвшинд ХААГДАНА («Имэйл хаяг буруу байна»
   * гэж 400 буцаана). Аль болохыг `auth.service` нь `@` тэмдэгтээр
   * ялгаж, буруу бол «Имэйл/утас эсвэл нууц үг буруу» гэсэн НЭГ
   * мессеж өгнө (бүртгэлтэй эсэхийг таахаас сэргийлнэ).
   */
  @IsString()
  @IsNotEmpty({ message: 'Имэйл эсвэл утасны дугаар оруулна уу' })
  @MaxLength(120)
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

  /**
   * Утас солих/устгах. Хоосон мөр = устгах.
   * ⚠️ Солиход `phoneVerified` ЦУЦЛАГДАНА (дахин баталгаажуулна).
   */
  @IsOptional()
  @IsString()
  phone?: string;

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

/** Нууц үг сэргээх хүсэлт — имэйл рүү линк илгээнэ */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;
}

/** Линкээр ирсэн токеноор шинэ нууц үг тавих */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Токен байхгүй байна' })
  /**
   * ⚠️ Урт хязгаар — токен нь ЯГ 64 hex тэмдэгт (randomBytes(32)).
   * Хязгааргүй бол халдлагч мега хэмжээний утга илгээж SHA-256
   * тооцуулах (CPU ядраах) боломжтой.
   */
  @MaxLength(200, { message: 'Токен буруу байна' })
  token: string;

  /**
   * ⚠️⚠️ RegisterDto-той ЯГ ИЖИЛ тоо байх ЁСТОЙ.
   *
   * Нэг газарт 8, нөгөөд 6 байвал хэрэглэгч «нууц үг сэргээх»
   * урсгалаар дүрмийг ТОЙРЧ сул нууц үг тавина. Аль нэгийг
   * өөрчлөх бол 4 газрыг ЦУГ өөрчилнө:
   *   auth.dto.ts × 3 · users.module.ts × 1 · frontend login/page.tsx
   *
   * ⚠️ Тоо/үсэг холих шаардлага ЗОРИУД БАЙХГҮЙ — дан тоо ч, дан
   * үсэг ч болно. Хэт хатуу дүрэм нь хэрэглэгчийг бүртгэлээс
   * няцаадаг (өөрөө нууц үгээ мартаж, сэргээх урсгал руу орно).
   */
  @IsString()
  @MinLength(6, { message: 'Нууц үг доод тал нь 6 тэмдэгт байна' })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Одоогийн нууц үг оруулна уу' })
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Шинэ нууц үг доод тал нь 6 тэмдэгт байна' })
  newPassword: string;
}

/**
 * Утас баталгаажуулах хүсэлт.
 *
 * ⚠️ Regex нь СУЛ (зай/зураас/+976 зөвшөөрнө) — хатуу шалгалтыг
 * `normalizePhone` хийнэ. Энд хатуу барих нь хэрэглэгчийг «+976 9900
 * 1122» гэж бичихэд шалтгаангүй татгалзахад хүргэнэ.
 */
export class RequestPhoneVerifyDto {
  @IsString()
  @Matches(/^[+\d\s()-]{8,20}$/, { message: 'Утасны дугаар буруу байна' })
  phone: string;
}
