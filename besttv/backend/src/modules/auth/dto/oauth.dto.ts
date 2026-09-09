import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class OAuthLoginDto {
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @IsString()
  providerAccountId: string;

  @IsOptional()
  @IsString()
  email?: string;

  /**
   * ⚠️⚠️ ПРОВАЙДЕР ИМЭЙЛИЙГ БАТАЛГААЖУУЛСАН ЭСЭХ.
   *
   * ⛔ БОДИТ ЭРСДЭЛ (2026-09-09 аудит): энэ талбар БАЙГААГҮЙ тул
   * backend нь имэйл баталгаажсан эсэхийг мэдэх аргагүй байв. Улмаас
   * баталгаажаагүй имэйлээр ХУУЧИН бүртгэлтэй холбогдож, **бүртгэл
   * булаах** боломжтой: хохирогч `victim@x.com`-оор нууц үгээр
   * бүртгүүлсэн (`emailVerified:false`) байхад халдагч тэр хаягийг
   * баталгаажуулаагүй provider-аар мэдэгдвэл хохирогчийн мөр олдож,
   * халдагч токен + `role` авна.
   *
   * ⚠️ Facebook нь баталгаажаагүй имэйл буцаадаг.
   * ⚠️ Mobile зам (`mobile-oauth.service.ts:66`) ҮҮНИЙГ ЗӨВ хийдэг —
   * вэб зам орхигдсон байв.
   *
   * ⚠️ ХУУЧИН клиенттэй нийцтэй: талбар байхгүй бол `undefined` →
   * `!== false` тул одоогийн зан төлөв ХЭВЭЭР (доор тайлбарлав).
   */
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

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
