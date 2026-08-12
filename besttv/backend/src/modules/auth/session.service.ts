import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * НЭВТЭРСЭН ТӨХӨӨРӨМЖИЙН УДИРДЛАГА.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: refresh token нь STATELESS JWT байсан тул
 * нэг эрхээр ХЯЗГААРГҮЙ төхөөрөмж зэрэг үзэж болдог байв — нэг хүн
 * 9,900₮-ийн багц авч 20 найздаа тараах боломжтой. Орлогод шууд
 * нөлөөтэй цоорхой.
 *
 * ⚠️ Хязгаар нь НЭВТЭРСЭН төхөөрөмжийн тоогоор (зэрэг үзэж буй
 * урсгалаар БИШ) — heartbeat хэрэггүй тул найдвартай, энгийн.
 */

/** Нэг эрхээр нэвтэрч болох дээд тоо */
export const MAX_DEVICES = 2;

export interface DeviceContext {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⚠️ Токеныг ЦЭВЭР утгаар хадгалахгүй — SHA-256 хэш.
   * DB задарсан ч хэн ч токеныг сэргээж ашиглах боломжгүй.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * User-Agent-ээс хүнд ойлгомжтой нэр гаргана.
   *
   * ⚠️ Нарийн сан (ua-parser) нэмэхгүй — хэрэглэгчид «энэ миний утас
   * мөн үү» гэдгийг ялгахад хангалттай. Танихгүй бол «Тодорхойгүй»
   * гэж худал таамаглахаас дээр.
   */
  deviceName(ua?: string | null): string {
    if (!ua) return 'Тодорхойгүй төхөөрөмж';
    const s = ua.toLowerCase();

    const os = s.includes('iphone')
      ? 'iPhone'
      : s.includes('ipad')
        ? 'iPad'
        : s.includes('android')
          ? 'Android'
          : s.includes('windows')
            ? 'Windows'
            : s.includes('mac os') || s.includes('macintosh')
              ? 'Mac'
              : s.includes('linux')
                ? 'Linux'
                : null;

    /* ⚠️ Дараалал ЧУХАЛ — Edge нь Chrome-ыг, Chrome нь Safari-г
       өөрийн UA-д агуулдаг тул онцгойгоос нь эхэлнэ */
    const browser = s.includes('edg/')
      ? 'Edge'
      : s.includes('opr/') || s.includes('opera')
        ? 'Opera'
        : s.includes('samsungbrowser')
          ? 'Samsung Internet'
          : s.includes('firefox')
            ? 'Firefox'
            : s.includes('chrome')
              ? 'Chrome'
              : s.includes('safari')
                ? 'Safari'
                : null;

    if (os && browser) return `${browser} · ${os}`;
    return browser ?? os ?? 'Тодорхойгүй төхөөрөмж';
  }

  /**
   * Шинэ session бүртгэнэ. Хязгаар хэтэрвэл ХАМГИЙН УДААН ИДЭВХГҮЙ
   * байсныг устгана (Netflix/Spotify маяг — хэрэглэгч саадгүй нэвтэрнэ).
   *
   * @returns гарсан төхөөрөмжийн нэр (байвал) — UI-д мэдэгдэж болно
   */
  async create(
    userId: string,
    refreshToken: string,
    ctx: DeviceContext,
    expiresAt: Date,
  ): Promise<{ evicted: string | null }> {
    const tokenHash = this.hash(refreshToken);

    try {
      /* ⚠️ Хугацаа дууссаныг эхлээд цэвэрлэнэ — эс бөгөөс тэдгээр
         хязгаарын байрыг дэмий эзэлнэ */
      await this.prisma.userSession.deleteMany({
        where: { userId, expiresAt: { lt: new Date() } },
      });

      const active = await this.prisma.userSession.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
        select: { id: true, deviceName: true },
      });

      let evicted: string | null = null;
      /* ⚠️ `>= MAX` — ШИНЭ session нэмэгдэх тул байр гаргана */
      if (active.length >= MAX_DEVICES) {
        const drop = active.slice(MAX_DEVICES - 1);
        await this.prisma.userSession.deleteMany({
          where: { id: { in: drop.map((d) => d.id) } },
        });
        evicted = drop[0]?.deviceName ?? 'Хуучин төхөөрөмж';
        this.logger.log(`Төхөөрөмжийн хязгаар: user=${userId} — ${drop.length} session гаргав`);
      }

      await this.prisma.userSession.create({
        data: {
          userId,
          tokenHash,
          deviceName: this.deviceName(ctx.userAgent),
          userAgent: ctx.userAgent?.slice(0, 400) ?? null,
          ip: ctx.ip ?? null,
          expiresAt,
        },
      });

      return { evicted };
    } catch (e) {
      /**
       * ⚠️ Session бүртгэж чадаагүй нь НЭВТРЭХИЙГ ЗОГСООХ ЁСГҮЙ.
       * DB түр саатсан үед хэрэглэгч орж чадахгүй байвал илүү муу.
       * Тэр токен нь `refresh` дээр «танигдаагүй» болж дахин
       * бүртгэгдэнэ (доорх `touch`).
       */
      this.logger.warn(`Session бүртгэж чадсангүй: ${String(e)}`);
      return { evicted: null };
    }
  }

  /**
   * Refresh үед session хүчинтэй эсэхийг шалгаж, идэвхийг шинэчилнэ.
   *
   * @returns `false` бол ТОКЕН ХҮЧИНГҮЙ (өөр төхөөрөмж гаргасан)
   */
  async touch(userId: string, refreshToken: string): Promise<boolean> {
    const tokenHash = this.hash(refreshToken);
    try {
      const s = await this.prisma.userSession.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true },
      });

      /**
       * ⚠️⚠️ SESSION ОЛДООГҮЙ = ГАРГАСАН гэсэн үг.
       *
       * Хязгаар хэтэрсэн үед хамгийн хуучин session устдаг тул тэр
       * төхөөрөмж дараагийн refresh дээр ЭНД ирнэ. `false` буцаавал
       * дахин нэвтрэх шаардлагатай болно — яг хүссэн зан төлөв.
       */
      if (!s || s.userId !== userId) return false;
      if (s.expiresAt < new Date()) {
        await this.prisma.userSession.delete({ where: { id: s.id } }).catch(() => null);
        return false;
      }

      await this.prisma.userSession.update({
        where: { id: s.id },
        data: { lastUsedAt: new Date() },
      });
      return true;
    } catch (e) {
      /* ⚠️ DB алдаа — хэрэглэгчийг гаргахгүй (fail-open). Хязгаарын
         хамгаалалт түр сулрах нь гацахаас дээр. */
      this.logger.warn(`Session шалгаж чадсангүй: ${String(e)}`);
      return true;
    }
  }

  /**
   * Refresh token солигдоход хуучин бүртгэлийг шинэчилнэ (rotation).
   * ⚠️ Хуучныг устгаад шинийг бичнэ — нэг төхөөрөмж 2 мөр эзлэхгүй.
   */
  async rotate(
    userId: string,
    oldToken: string,
    newToken: string,
    ctx: DeviceContext,
    expiresAt: Date,
  ): Promise<void> {
    try {
      await this.prisma.userSession.deleteMany({ where: { tokenHash: this.hash(oldToken) } });
      await this.prisma.userSession.create({
        data: {
          userId,
          tokenHash: this.hash(newToken),
          deviceName: this.deviceName(ctx.userAgent),
          userAgent: ctx.userAgent?.slice(0, 400) ?? null,
          ip: ctx.ip ?? null,
          expiresAt,
        },
      });
    } catch (e) {
      this.logger.warn(`Session сэлгэж чадсангүй: ${String(e)}`);
    }
  }

  /** Хэрэглэгчийн бүх идэвхтэй төхөөрөмж (профайлд харуулна) */
  async list(userId: string, currentToken?: string | null) {
    const currentHash = currentToken ? this.hash(currentToken) : null;
    const rows = await this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        ip: true,
        lastUsedAt: true,
        createdAt: true,
        tokenHash: true,
      },
    });

    return {
      max: MAX_DEVICES,
      items: rows.map((r) => ({
        id: r.id,
        deviceName: r.deviceName ?? 'Тодорхойгүй төхөөрөмж',
        ip: r.ip,
        lastUsedAt: r.lastUsedAt,
        createdAt: r.createdAt,
        /* ⚠️ Одоо ашиглаж буйг тэмдэглэнэ — хэрэглэгч өөрийгөө
           санамсаргүй гаргахгүй */
        current: currentHash ? r.tokenHash === currentHash : false,
      })),
    };
  }

  /** Тодорхой төхөөрөмжийг гаргах (профайлаас) */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    /* ⚠️ `userId` нөхцөл ЗААВАЛ — өөр хүний session устгах IDOR-оос
       хамгаална */
    const res = await this.prisma.userSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return res.count > 0;
  }

  /** Бусад БҮХ төхөөрөмжийг гаргах (нууц үг алдагдсан үед) */
  async revokeOthers(userId: string, currentToken?: string | null): Promise<number> {
    const res = await this.prisma.userSession.deleteMany({
      where: {
        userId,
        ...(currentToken ? { NOT: { tokenHash: this.hash(currentToken) } } : {}),
      },
    });
    return res.count;
  }
}
