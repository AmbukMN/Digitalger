import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      /**
       * ⚠️⚠️ ХОЁР ЭХ СУРВАЛЖ — ЗӨВХӨН HEADER-Д НАЙДАЖ БОЛОХГҮЙ.
       *
       * Production-д нэг хэрэглэгч ГАНЦ Chrome profile дээрээ нэвтэрч
       * чаддаггүй байв (incognito-д БОЛОН гар утсан дээр асуудалгүй).
       * Ялгаа нь EXTENSION: зарим өргөтгөл `fetch`/`XHR`-ыг залгаж
       * `Authorization` header-ыг арилгадаг эсвэл өөрчилдөг. Тэр үед
       * бүх хүсэлт 401 болж, хэрэглэгч "Нэвтрэх" товч хараад л үлддэг —
       * ямар ч код засвар тус болохгүй.
       *
       * Одоо header байхгүй бол `btv_token` cookie-оос уншина. Cookie нь
       * browser өөрөө явуулдаг тул JS-ийн давхаргад залгагдахгүй.
       *
       * ⚠️ Дараалал чухал: HEADER ЭХЭНД — олон хэрэглэгч нэг browser-т
       * (эсвэл админ+хэрэглэгч зэрэг) байвал header нь тухайн үйлдлийн
       * зөв эзэн; cookie бол зөвхөн нөөц.
       */
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: { cookies?: Record<string, string> }) => req?.cookies?.btv_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
      /** ⚠️ ТҮР ОНОШИЛГОО — татгалзсан шалтгааныг мэдэхэд req хэрэгтэй */
      passReqToCallback: true,
    });
  }

  /**
   * ⚠️ ТҮР ОНОШИЛГОО — `/auth/me` 401 болох ЯГ шалтгааныг production логт
   * бичнэ. Нэг хэрэглэгчийн browser дээр л 401 гарч байгаа ч (curl,
   * Playwright, incognito, гар утас бүгд ✅) шалтгаан нь хаана ч
   * харагдахгүй байв. Асуудал шийдэгдмэгц ЭНЭ БЛОКЫГ ХАСНА.
   */
  async validate(
    req: { url?: string; headers?: Record<string, unknown>; cookies?: Record<string, string> },
    payload: JwtPayload,
  ): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      const auth = String(req?.headers?.authorization ?? '');
      // eslint-disable-next-line no-console
      console.warn(
        `[jwt] ТАТГАЛЗЛАА: ХЭРЭГЛЭГЧ ОЛДСОНГҮЙ sub=${payload.sub} email=${payload.email} url=${req?.url} эх=${auth ? 'header' : req?.cookies?.btv_token ? 'cookie' : '?'}`,
      );
      throw new UnauthorizedException('Хэрэглэгч олдсонгүй');
    }
    if (!user.isActive) {
      // eslint-disable-next-line no-console
      console.warn(`[jwt] ТАТГАЛЗЛАА: БҮРТГЭЛ ХААГДСАН sub=${payload.sub} url=${req?.url}`);
      throw new UnauthorizedException('Таны бүртгэл хаагдсан байна');
    }

    return { sub: user.id, email: user.email, role: user.role };
  }
}
