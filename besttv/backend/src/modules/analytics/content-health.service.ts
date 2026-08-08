import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * КОНТЕНТЫН ЭРҮҮЛ МЭНД — «мөнгө авчихаад үзүүлэх юмгүй» байдлыг илрүүлнэ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (бодит тохиолдол):
 * «Шилдэг кино» багц 9,900₮-өөр ЗАРАГДАЖ байсан атлаа доторх 4 киноны
 * НЭГ Ч нь тоглох боломжгүй байв (2 нь видеогүй, 2 нь хөрвүүлэлт дунд).
 * Хэн нэг нь худалдан авсан бол мөнгөө төлөөд ХООСОН сан хардаг байв.
 * Үүнийг би ГАРААР SQL бичиж байж л оллоо — систем өөрөө хэлэх ёстой.
 *
 * ⚠️ Энэ нь зөвхөн ТАЙЛАН — юу ч автоматаар унтраахгүй, устгахгүй.
 * Шийдвэрийг админ гаргана (багц түр хаах уу, видео нэмэх үү).
 */

export type HealthLevel = 'critical' | 'warning' | 'ok';

export interface HealthIssue {
  level: HealthLevel;
  /** Богино гарчиг — админ жагсаалтад харагдана */
  title: string;
  /** Юу болсныг тайлбарлана */
  detail: string;
  /** Админ хаашаа очиж засах вэ */
  href?: string;
  /** Хамаарах объектын нэрс (эхний хэдэн ширхэг) */
  items?: string[];
}

export interface ContentHealthResult {
  issues: HealthIssue[];
  counts: { critical: number; warning: number };
  checkedAt: string;
}

/** Жагсаалтад дээд тал нь хэдэн нэр харуулах (UI бөглөрөхөөс сэргийлнэ) */
const MAX_NAMES = 8;

@Injectable()
export class ContentHealthService {
  constructor(
    private readonly prisma: PrismaService,
    /* ⚠️ Имэйл тохиргоо алдагдсаныг илрүүлэхэд (`isConfigured`) */
    private readonly email: EmailService,
  ) {}

  async check(): Promise<ContentHealthResult> {
    const issues: HealthIssue[] = [];

    const [plans, brokenTitles, failed, failedEpisodes, stuck, noPoster] = await Promise.all([
      this.prisma.plan.findMany({
        where: { isActive: true },
        include: { genres: { select: { genreId: true } } },
      }),
      /**
       * Хөрвүүлэлт явж буй кино (доорх №2-т мэдээлнэ).
       *
       * ⚠️ `comingSoon` нь ЗОРИУД видеогүй тул хасна.
       * ⚠️ `type: MOVIE` ЗААВАЛ — SERIES-ийн `Title.streamStatus` нь
       * үргэлж `NONE` (видео нь анги дээр) тул шүүхгүй бол бүх цуврал
       * "боловсруулагдаж байна" гэж ХУДАЛ тоологдоно.
       */
      this.prisma.title.findMany({
        where: {
          isActive: true,
          comingSoon: false,
          type: 'MOVIE',
          streamStatus: { notIn: ['READY'] },
        },
        select: { id: true, title: true, streamStatus: true },
        take: 200,
      }),
      /* ⚠️ АНГИ ч унаж болно — өмнө нь зөвхөн Title шалгадаг байсан тул
         10 ангийн бүгд FAILED болсон ч админд ОГТ мэдэгдэхгүй байв */
      this.prisma.title.findMany({
        where: { streamStatus: 'FAILED' },
        select: { title: true, streamError: true },
        take: 50,
      }),
      this.prisma.episode.findMany({
        where: { streamStatus: 'FAILED' },
        select: {
          number: true,
          streamError: true,
          season: { select: { title: { select: { title: true } } } },
        },
        take: 50,
      }),
      /**
       * ⚠️ 9 ЦАГААС УДСАН хөрвүүлэлт — гацсан гэж үзнэ.
       *
       * ⚠️ `video-hls.service.ts`-ийн ЭЦСИЙН таймаут нь 8 цаг тул
       * түүнээс ДЭЭГҮҮР байх ёстой — эс бөгөөс ffmpeg өөрөө зогсоохоос
       * ӨМНӨ "гацсан" гэж худал мэдээлнэ. (Жинхэнэ гацааг 25 минутын
       * явцын хяналт хамаагүй хурдан барина.)
       */
      this.prisma.title.findMany({
        where: {
          streamStatus: 'PROCESSING',
          streamStartedAt: { lt: new Date(Date.now() - 9 * 3600_000) },
        },
        select: { title: true, streamStartedAt: true },
        take: 50,
      }),
      this.prisma.title.count({
        where: { isActive: true, posterKey: null },
      }),
    ]);

    /* ─── 1. Багц бүр — үзэх боломжтой контент байна уу ─────────────── */
    /**
     * ⚠️⚠️ ЦУВРАЛЫН ВИДЕО НЬ TITLE ДЭЭР БИШ, АНГИ ДЭЭР.
     *
     * `Title.streamStatus` нь SERIES-д ХЭЗЭЭ Ч `READY` болдоггүй
     * (тэр талбарыг зөвхөн MOVIE ашигладаг). Тиймээс зөвхөн түүгээр
     * шүүвэл 10 анги нь бүрэн бэлэн цуврал ч "тоглох боломжгүй" гэж
     * тоологдож, багц мөнхөд "🔴 үзэх кино алга" гэж ХУДАЛ
     * сэрэмжлүүлнэ.
     *
     * MOVIE  → `Title.streamStatus = READY`
     * SERIES → НЭГ Ч анги `READY` бол үзэх боломжтой
     */
    const [readyMovies, readySeries] = await Promise.all([
      this.prisma.title.findMany({
        where: { isActive: true, comingSoon: false, streamStatus: 'READY' },
        select: { id: true },
      }),
      this.prisma.title.findMany({
        where: {
          isActive: true,
          comingSoon: false,
          type: 'SERIES',
          seasons: { some: { episodes: { some: { streamStatus: 'READY' } } } },
        },
        select: { id: true },
      }),
    ]);
    const readyIds = new Set([...readyMovies, ...readySeries].map((t) => t.id));

    for (const plan of plans) {
      const genreIds = plan.genres.map((g) => g.genreId);

      /* ⚠️ VIP нь БҮХ киног хамардаг (жанрын холбоосгүй) — тусад нь бодно */
      const links = plan.isVip
        ? await this.prisma.title.findMany({
            where: { isActive: true, comingSoon: false },
            select: { id: true },
          })
        : genreIds.length
          ? (
              await this.prisma.titleGenre.findMany({
                where: { genreId: { in: genreIds }, title: { isActive: true, comingSoon: false } },
                select: { titleId: true },
              })
            ).map((l) => ({ id: l.titleId }))
          : [];

      const total = new Set(links.map((l) => l.id)).size;
      const playable = [...new Set(links.map((l) => l.id))].filter((id) => readyIds.has(id)).length;

      if (!plan.isVip && !genreIds.length) {
        issues.push({
          level: 'critical',
          title: `«${plan.name}» багц жанргүй`,
          detail: `${plan.price.toLocaleString('mn-MN')}₮-өөр зарагдаж байгаа ч ямар ч жанр холбоогүй тул худалдан авсан хүн ЮУ Ч үзэж чадахгүй.`,
          href: '/plans',
        });
        continue;
      }

      /**
       * ⚠️ ЗӨВХӨН «нэг ч үзэгдэхгүй» тохиолдолд хэлнэ — энэ нь мөнгө
       * авчихаад хоосон сан үзүүлэх эрсдэл. Цөөн кинотой бол админ
       * зориуд тэгсэн байж болно (шинэ багц дүүргэж байгаа) тул
       * тоолж дүгнэхгүй.
       */
      if (total > 0 && playable === 0) {
        issues.push({
          level: 'critical',
          title: `«${plan.name}» багцад үзэх кино алга`,
          detail: `${plan.price.toLocaleString('mn-MN')}₮-өөр зарагдаж байна. ${total} кино холбоотой ч нэг нь ч тоглох бэлэн болоогүй. Хөрвүүлэлт дуусаагүй бол хүлээнэ, эс бөгөөс багцыг түр хаах нь зүйтэй.`,
          href: '/plans',
        });
      }
    }

    /**
     * ─── 2. Хөрвүүлэлт явж буй кино (мэдээлэл) ────────────────────────
     *
     * ⚠️ «Видео ороогүй» (`streamStatus = NONE`) талаар АНХААРУУЛАХГҮЙ —
     * админ видеогоо өөрөө төлөвлөж, дараалалтай байршуулдаг тул энэ нь
     * АЛДАА БИШ, хэвийн ажлын урсгал. Тийм сэрэмжлүүлэг зөвхөн чимээ
     * шуугиан үүсгэж, ЖИНХЭНЭ асуудлыг (FAILED, гацсан) дарж орхино.
     */
    const processing = brokenTitles.filter((t) => t.streamStatus === 'PROCESSING');
    if (processing.length) {
      issues.push({
        level: 'warning',
        title: `${processing.length} кино хөрвүүлэлтэд байна`,
        detail: 'Хөрвүүлэлт дуусмагц автоматаар үзэгдэнэ. Арга хэмжээ авах шаардлагагүй.',
        href: '/movies',
        items: processing.slice(0, MAX_NAMES).map((t) => t.title),
      });
    }

    /* ─── 3. Амжилтгүй хөрвүүлэлт ───────────────────────────────────── */
    if (failed.length) {
      issues.push({
        level: 'critical',
        title: `${failed.length} киноны хөрвүүлэлт амжилтгүй`,
        detail: failed[0].streamError
          ? `Жишээ алдаа: ${failed[0].streamError.slice(0, 120)}`
          : 'Дэлгэрэнгүйг кино засварлах хуудаснаас харна уу.',
        href: '/movies',
        items: failed.slice(0, MAX_NAMES).map((t) => t.title),
      });
    }

    /**
     * ⚠️ АНГИЙН амжилтгүй хөрвүүлэлт — ТУСДАА мэдээлнэ.
     *
     * Өмнө нь зөвхөн `Title` шалгадаг байсан тул цувралын 10 анги
     * бүгд унасан ч админд ОГТ мэдэгдэхгүй байв — цуврал "бэлэн"
     * харагдаж, хэрэглэгч дарахад юу ч тоглохгүй.
     */
    if (failedEpisodes.length) {
      issues.push({
        level: 'critical',
        title: `${failedEpisodes.length} ангийн хөрвүүлэлт амжилтгүй`,
        detail: failedEpisodes[0].streamError
          ? `Жишээ алдаа: ${failedEpisodes[0].streamError.slice(0, 120)}`
          : 'Дэлгэрэнгүйг цувралын засварлах хуудаснаас харна уу.',
        href: '/movies',
        items: failedEpisodes
          .slice(0, MAX_NAMES)
          .map((e) => `${e.season?.title?.title ?? 'Цуврал'} — ${e.number}-р анги`),
      });
    }

    /* ─── 4. Гацсан хөрвүүлэлт ──────────────────────────────────────── */
    if (stuck.length) {
      issues.push({
        level: 'warning',
        title: `${stuck.length} хөрвүүлэлт 6 цагаас удлаа`,
        detail:
          'Ажил гацсан байж магадгүй. Сэргээх cron автоматаар дахин оролдоно; давтагдвал серверийн дискний зай шалгана уу.',
        href: '/movies',
        items: stuck.slice(0, MAX_NAMES).map((t) => t.title),
      });
    }

    /* ─── 5. Постергүй кино ─────────────────────────────────────────── */
    if (noPoster > 0) {
      issues.push({
        level: 'warning',
        title: `${noPoster} кино постергүй`,
        detail: 'Нүүр хуудсанд саарал хайрцаг харагдана — хэрэглэгчийн итгэл буурна.',
        href: '/movies',
      });
    }

    /* ─── 6. Имэйл илгээх боломжгүй ─────────────────────────────────
     *
     * ⚠️⚠️ ЧИМЭЭГҮЙ АЛДАГДАЛ: AWS түлхүүр `.env`-ээс алга болоход
     * систем ажилласаар байв — зөвхөн startup дээр нэг `warn` мөр.
     * Худалдан авагч баримт авахгүй, нууц үг сэргээх холбоос хэзээ ч
     * ирэхгүй, хэрэглэгч "сайт эвдэрсэн" гэж бодно. Админ логоо
     * уншихгүй бол ХЭЗЭЭ Ч мэдэхгүй.
     */
    if (!this.email.isConfigured) {
      issues.push({
        level: 'critical',
        title: 'Имэйл илгээх тохиргоо дутуу',
        detail:
          'AWS түлхүүр байхгүй тул НЭГ Ч имэйл илгээгдэхгүй байна — худалдан авалтын баримт, нууц үг сэргээх холбоос, баталгаажуулалт бүгд явахгүй. `.env`-д AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY нэмнэ үү.',
        href: '/email',
      });
    }

    /* ─── 7. Сүүлийн үеийн амжилтгүй имэйл ──────────────────────────── */
    const failedEmails = await this.prisma.emailLog.count({
      where: { status: 'failed', createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } },
    });
    if (failedEmails > 0) {
      issues.push({
        level: 'warning',
        title: `${failedEmails} имэйл сүүлийн 24 цагт амжилтгүй`,
        detail: 'Имэйлийн бүртгэлээс шалтгааныг харна уу.',
        href: '/email',
      });
    }

    return {
      issues,
      counts: {
        critical: issues.filter((i) => i.level === 'critical').length,
        warning: issues.filter((i) => i.level === 'warning').length,
      },
      checkedAt: new Date().toISOString(),
    };
  }
}
