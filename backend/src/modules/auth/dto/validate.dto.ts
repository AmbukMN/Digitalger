import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** NextAuth credentials provider validation. Password ЗААВАЛ (мэдээлэл задрах
 * нүхээс сэргийлж — нууц үггүйгээр хэрэглэгчийн мэдээлэл буцаахгүй). */
export class ValidateDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
