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

/**
 * ⚠️⚠️ ГАР УТАСНЫ АППЫН OAUTH.
 *
 * Апп нь `x-oauth-secret` ашиглаж БОЛОХГҮЙ (bundle доторх нууц
 * задардаг) тул провайдерын `id_token`-ыг илгээнэ. Сервер нь түүнийг
 * провайдерын нийтийн түлхүүрээр шалгана.
 */
export class MobileOAuthDto {
  @IsIn(['google', 'facebook', 'apple'])
  provider: 'google' | 'facebook' | 'apple';

  /** Провайдерын `id_token` (JWT) */
  @IsString()
  idToken: string;

  /**
   * ⚠️ APPLE-Д ЗААВАЛ ЧУХАЛ: Apple нь нэрийг ЗӨВХӨН АНХНЫ нэвтрэлтэд
   * өгдөг ба `id_token` дотор ОГТ байдаггүй. Апп тусад нь илгээхгүй
   * бол хэрэглэгч мөнхөд нэргүй үлдэнэ (дахин авах ЗАМГҮЙ).
   */
  @IsOptional()
  @IsString()
  name?: string;
}
