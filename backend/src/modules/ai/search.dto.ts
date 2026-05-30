import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query: string;
}
