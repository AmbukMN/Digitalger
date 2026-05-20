import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsString()
  layoutMode?: string;

  @IsOptional()
  @IsIn(['system', 'light', 'dark'])
  defaultTheme?: string;
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  siteName?: string;

  @IsOptional()
  @IsString()
  siteUrl?: string;

  @IsOptional()
  @IsString()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
