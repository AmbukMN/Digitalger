import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';
import { currentSite, hasSiteContext, runAcrossSites } from '../../../common/site/site-context';
import { Role } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    /**
     * ⚠️⚠️ `site` ЗААВАЛ SELECT ХИЙНЭ — ХАМГААЛАЛТЫН ҮНДЭС.
     *
     * БОДИТ АЛДАА (аудитаар илэрсэн): `select`-д `site` байхгүй байв.
     * Prisma-ийн site өргөтгөл нь `findUnique`-д `where` шүүлт
     * НЭМДЭГГҮЙ, зөвхөн буцсан мөрийг post-filter хийдэг:
     *
     *     if (scoped && 'site' in row && row.site !== site) return null;
     *
     * `select`-д `site` байхгүй бол буцсан объектод тэр талбар ОГТ
     * байхгүй → `'site' in row` нь `false` → **шалгалт бүхэлдээ
     * алгасагдана**.
     *
     * Үр дүнд BestTV-д нэвтэрсэн хэрэглэгчийн токеныг bestfilm.net
     * руу явуулбал амжилттай нэвтэрдэг байв — сайт хоорондын
     * нэвтрэлтийн хил ЧИМЭЭГҮЙ унтарсан. `site.middleware.ts` нь яг
     * энэ эрсдэлийг баримтжуулсан ч `select` нь хамгаалалтыг хүчгүй
     * болгосон.
     */
    /**
     * ⚠️⚠️ АДМИН НЬ ХОЁР САЙТЫГ УДИРДДАГ — түүнийг ХААХГҮЙ.
     *
     * БОДИТ АЛДАА (энэ засварыг хийх үед гарсан): зөвхөн `site: true`
     * нэмэхэд админ панель БҮХЭЛДЭЭ эвдэрсэн — админ BestFilm сонгоход
     * бүх дуудлага 401 болов. Учир нь админы данс нь `besttv` сайтад
     * бүртгэлтэй атал `X-Site: bestfilm` толгойтой хүсэлт илгээдэг.
     *
     * ⚠️ Тиймээс хэрэглэгчийг ХАЙХДАА site шүүлтийг ТҮР УНТРААНА,
     * шалгалтыг ГАРААР хийнэ:
     *   · ADMIN     → хоёр сайтад зөвшөөрнө (панель ажиллана)
     *   · энгийн    → өөрийн сайтад л (нэвтрэлтийн хил хаалттай)
     *
     * Энэ нь `runAcrossSites`-ийн ЦӨӨН зөвшөөрөгдсөн хэрэглээний нэг.
     */
    const user = await runAcrossSites(() =>
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true, site: true },
      }),
    );

    if (!user) throw new UnauthorizedException('Хэрэглэгч олдсонгүй');
    if (!user.isActive) throw new UnauthorizedException('Таны бүртгэл хаагдсан байна');

    /**
     * ⚠️⚠️ САЙТ ХООРОНДЫН НЭВТРЭЛТИЙН ХИЛ.
     *
     * ЭНГИЙН хэрэглэгч ӨӨРИЙН сайтад л нэвтэрнэ — BestTV-д бүртгүүлсэн
     * хүн bestfilm.net дээр өөрийн токеноор орж БОЛОХГҮЙ.
     *
     * ⚠️ АДМИН нь ОНЦГОЙ: нэг панелаас хоёр сайтыг удирддаг тул
     * `X-Site` ямар ч байсан зөвшөөрнө. Эрхийг `RolesGuard` болон
     * `AllSitesGuard` тусад нь шалгана.
     *
     * ⚠️ Контекстгүй үед (cron, worker) шалгахгүй — `currentSite()`
     * нь `besttv` буцаах тул BestFilm-ийн хэрэглэгчийг буруугаар
     * хаана.
     */
    if (user.role !== Role.ADMIN && hasSiteContext() && user.site !== currentSite()) {
      throw new UnauthorizedException('Хэрэглэгч олдсонгүй');
    }

    return { sub: user.id, email: user.email, role: user.role };
  }
}
