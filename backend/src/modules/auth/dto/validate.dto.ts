import { IsEmail, IsOptional, IsString } from 'class-validator';

/** NextAuth credentials provider validation */
export class ValidateDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  password?: string;
}
