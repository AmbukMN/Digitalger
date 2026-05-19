import { IsOptional, IsString } from 'class-validator';

export class OAuthDto {
  @IsString()
  provider!: string;

  @IsString()
  providerAccountId!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;
}
