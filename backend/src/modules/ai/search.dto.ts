import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query: string;
}
