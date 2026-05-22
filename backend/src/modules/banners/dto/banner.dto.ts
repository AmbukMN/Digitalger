import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBannerDto {
  @IsString()
  title!: string;

  @IsOptional() @IsString()
  subtitle?: string;

  @IsString()
  imageUrl!: string;

  @IsOptional() @IsString()
  mobileImageUrl?: string;

  @IsOptional() @IsString()
  desktopImageUrl?: string;

  @IsOptional() @IsString()
  videoUrl?: string;

  @IsOptional() @IsString()
  linkUrl?: string;

  @IsOptional() @IsString()
  linkLabel?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsString()
  bgColor?: string;

  @IsOptional() @IsDateString()
  startsAt?: string;

  @IsOptional() @IsDateString()
  endsAt?: string;
}

export class UpdateBannerDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  subtitle?: string;

  @IsOptional() @IsString()
  imageUrl?: string;

  @IsOptional() @IsString()
  mobileImageUrl?: string;

  @IsOptional() @IsString()
  desktopImageUrl?: string;

  @IsOptional() @IsString()
  videoUrl?: string;

  @IsOptional() @IsString()
  linkUrl?: string;

  @IsOptional() @IsString()
  linkLabel?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsString()
  bgColor?: string;

  @IsOptional() @IsDateString()
  startsAt?: string;

  @IsOptional() @IsDateString()
  endsAt?: string;
}
