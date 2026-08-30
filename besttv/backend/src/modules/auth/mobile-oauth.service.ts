import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * ⚠️⚠️⚠️ ГАР УТАСНЫ АППЫН OAUTH — `id_token`-ыг ӨӨРСДӨӨ ШАЛГАНА.
 *
 * ЯАГААД ТУСДАА ВЭ:
 *
 * Одоогийн `/auth/oauth` нь `x-oauth-secret` header шаарддаг. Тэр нь
 * СЕРВЕР-СЕРВЕРИЙН нууц — Next.js сервер л мэднэ. Гар утасны апп бол
 * КЛИЕНТ: bundle доторх ямар ч нууцыг задлан шинжилж гаргаж авна
 * (`strings`, Hopper, эсвэл зүгээр APK задлах). Тэр нууц алдагдвал
 * **хэн ч ямар ч имэйлээр нэвтэрч, ADMIN эрх авна**.
 *
 * Тиймээс апп нь провайдерын `id_token`-ыг илгээж, СЕРВЕР нь түүнийг
 * провайдерын НИЙТИЙН ТҮЛХҮҮРЭЭР шалгана. Нууц хуваалцахгүй.
 *
 * ⚠️ `aud` (audience) ЗААВАЛ шалгана — эс бөгөөс өөр аппын хүчинтэй
 *    токеноор манай хэрэглэгчийн бүртгэлд нэвтэрч болно.
 */
@Injectable()
export class MobileOAuthService {
  private readonly logger = new Logger(MobileOAuthService.name);

  /**
   * ⚠️ JWKS нь модулийн түвшинд — `createRemoteJWKSet` нь түлхүүрийг
   * КЭШЛЭДЭГ. Хүсэлт бүрд шинээр үүсгэвэл нэвтрэлт бүрд Google/Apple
   * рүү нэмэлт хүсэлт явж удаашрана.
   */
  private readonly googleJwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
  );
  private readonly appleJwks = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  constructor(private readonly config: ConfigService) {}

  /**
   * Google `id_token`-ыг шалгана.
   *
   * ⚠️ `aud` нь iOS/Android/Web клиент бүрд ӨӨР байдаг тул бүгдийг
   *    зөвшөөрөх жагсаалтаар шалгана.
   */
  async verifyGoogle(idToken: string): Promise<{
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  }> {
    const allowed = this.clientIds('GOOGLE_MOBILE_CLIENT_IDS');
    if (!allowed.length) {
      /* ⚠️ Тохируулаагүй бол ХААНА — задгай үлдээвэл `aud` шалгагдахгүй
         тул ДУРЫН Google аппын токеноор нэвтэрнэ */
      throw new UnauthorizedException('Google нэвтрэлт тохируулагдаагүй байна');
    }

    const payload = await this.verify(idToken, this.googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: allowed,
    });

    /* ⚠️ Google нь имэйл баталгаажаагүй байж болно — тэр үед имэйлээр
       ХУУЧИН бүртгэлтэй холбох нь бүртгэл булаах халдлага болно */
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    return {
      sub: String(payload.sub),
      email: verified ? (payload.email as string | undefined) : undefined,
      name: payload.name as string | undefined,
      picture: payload.picture as string | undefined,
    };
  }

  /**
   * Apple `id_token`-ыг шалгана.
   *
   * ⚠️⚠️ APPLE-ИЙН ОНЦЛОГ:
   *
   * 1. **Нэр нь ЗӨВХӨН НЭГ УДАА ирнэ** — хамгийн анхны нэвтрэлтэд.
   *    Токенд ОГТ байдаггүй, апп тусад нь илгээх ёстой. Хадгалахгүй
   *    бол хэрэглэгч мөнхөд нэргүй үлдэнэ (дахин авах ЗАМГҮЙ).
   *
   * 2. **Имэйл нуугдмал байж болно** — `@privaterelay.appleid.com`.
   *    Энэ нь хүчинтэй хаяг (Apple дамжуулдаг) тул хүлээн авна.
   *
   * 3. **`sub` нь АПП ТУС БҮРД өөр** — bundle ID солибол бүх хэрэглэгч
   *    шинэ ID авч, хуучин бүртгэлээ АЛДАНА.
   */
  async verifyApple(idToken: string): Promise<{
    sub: string;
    email?: string;
  }> {
    const allowed = this.clientIds('APPLE_CLIENT_IDS');
    if (!allowed.length) {
      throw new UnauthorizedException('Apple нэвтрэлт тохируулагдаагүй байна');
    }

    const payload = await this.verify(idToken, this.appleJwks, {
      issuer: 'https://appleid.apple.com',
      audience: allowed,
    });

    /* ⚠️ Apple-ийн `email_verified` нь МӨР эсвэл boolean байж болно */
    const verified =
      payload.email_verified === true || payload.email_verified === 'true';
    return {
      sub: String(payload.sub),
      email: verified ? (payload.email as string | undefined) : undefined,
    };
  }

  /**
   * Нийтлэг баталгаажуулалт.
   *
   * ⚠️ Алдааны шалтгааныг ХЭРЭГЛЭГЧИД ХЭЛЭХГҮЙ — «токен хугацаа
   *    дууссан» vs «гарын үсэг буруу» гэдэг нь халдагчид мэдээлэл өгнө.
   *    Логт л дэлгэрэнгүй үлдээнэ.
   */
  private async verify(
    token: string,
    jwks: ReturnType<typeof createRemoteJWKSet>,
    opts: { issuer: string | string[]; audience: string[] },
  ): Promise<JWTPayload & { email?: unknown; email_verified?: unknown; name?: unknown; picture?: unknown }> {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: opts.issuer,
        audience: opts.audience,
        /* ⚠️ 60 сек зөрүү зөвшөөрнө — утасны цаг серверээс хазайж болно */
        clockTolerance: 60,
      });
      return payload;
    } catch (e) {
      this.logger.warn(`id_token шалгалт амжилтгүй: ${String(e)}`);
      throw new UnauthorizedException('Нэвтрэлт баталгаажсангүй');
    }
  }

  /** Таслалаар тусгаарласан client ID жагсаалт */
  private clientIds(key: string): string[] {
    const raw = this.config.get<string>(key) ?? process.env[key] ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
