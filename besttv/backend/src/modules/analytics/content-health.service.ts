import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<ContentHealthResult> {
    const issues: HealthIssue[] = [];

    const [plans, brokenTitles, failed, stuck, noPoster] = await Promise.all([
      this.prisma.plan.findMany({
        where: { isActive: true },
        include: { genres: { select: { genreId: true } } },
      }),
      /* Идэвхтэй мөртлөө ТОГЛОХГҮЙ кино — хэрэглэгч дарж ороод юу ч болохгүй.
         ⚠️ `comingSoon` нь ЗОРИУД видеогүй тул хасна. */
      this.prisma.title.findMany({
        where: { isActive: true, comingSoon: false, streamStatus: { notIn: ['READY'] } },
        select: { id: true, title: true, streamStatus: true },
        take: 200,
      }),
      this.prisma.title.findMany({
        where: { streamStatus: 'FAILED' },
        select: { title: true, streamError: true },
        take: 50,
      }),
      /**
       * ⚠️ 6 ЦАГААС УДСАН хөрвүүлэлт — гацсан гэж үзнэ.
       * ffmpeg таймаут нь 180 мин (3 ц); 4 ажил зэрэг явахад CPU
       * өрсөлдөөнөөс удааширдаг тул 2 дахин зай авав. Үүнээс дээш
       * бол queue сэргээх cron ажиллаагүй гэсэн үг.
       */
      this.prisma.title.findMany({
        where: {
          streamStatus: 'PROCESSING',
          streamStartedAt: { lt: new Date(Date.now() - 6 * 3600_000) },
        },
        select: { title: true, streamStartedAt: true },
        take: 50,
      }),
      this.prisma.title.count({
        where: { isActive: true, posterKey: null },
      }),
    ]);

    /* ─── 1. Багц бүр — үзэх боломжтой контент байна уу ─────────────── */
    const readyIds = new Set(
      (
        await this.prisma.title.findMany({
          where: { isActive: true, comingSoon: false, streamStatus: 'READY' },
          select: { id: true },
        })
      ).map((t) => t.id),
    );

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
