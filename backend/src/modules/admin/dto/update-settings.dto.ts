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

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsString()
  ogTitle?: string;

  @IsOptional()
  @IsString()
  ogDescription?: string;

  @IsOptional()
  @IsString()
  ogImageUrl?: string;

  @IsOptional()
  @IsString()
  twitterCardType?: string;

  @IsOptional()
  robotsNoIndex?: boolean;

  @IsOptional()
  robotsNoFollow?: boolean;

  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @IsOptional()
  @IsString()
  googleAnalyticsId?: string;

  @IsOptional()
  @IsString()
  googleTagManagerId?: string;

  @IsOptional()
  @IsString()
  fbPixelId?: string;

  @IsOptional()
  @IsString()
  googleSiteVerification?: string;

  @IsOptional()
  @IsString()
  naverSiteVerification?: string;

  @IsOptional()
  sitemapEnabled?: boolean;

  @IsOptional()
  @IsString()
  sitemapChangeFreq?: string;

  @IsOptional()
  @IsString()
  sitemapPriority?: string;

  @IsOptional()
  @IsString()
  socialFacebook?: string;

  @IsOptional()
  @IsString()
  socialInstagram?: string;

  @IsOptional()
  @IsString()
  socialTwitter?: string;

  @IsOptional()
  @IsString()
  socialThreads?: string;

  @IsOptional()
  @IsString()
  socialTelegram?: string;

  @IsOptional()
  @IsString()
  socialWhatsapp?: string;

  @IsOptional()
  @IsString()
  socialTiktok?: string;

  @IsOptional()
  @IsString()
  socialYoutube?: string;

  @IsOptional()
  @IsString()
  socialLinkedin?: string;
}
