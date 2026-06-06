import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150) // хайлтын үг 150 тэмдэгтээс хэтрэхгүй (DB tsquery ачаалал/DoS-аас сэргийлнэ)
  query: string;
}
