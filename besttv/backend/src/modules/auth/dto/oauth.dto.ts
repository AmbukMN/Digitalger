import { IsIn, IsOptional, IsString } from 'class-validator';

export class OAuthLoginDto {
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @IsString()
  providerAccountId: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Google/Facebook profile зураг URL — R2 руу mirror хийгдэнэ */
  @IsOptional()
  @IsString()
  image?: string;
}
