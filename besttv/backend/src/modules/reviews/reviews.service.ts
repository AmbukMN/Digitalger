import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ReviewSort = 'helpful' | 'newest' | 'oldest' | 'highest' | 'lowest';

const MAX_COMMENT = 3000;

/**
 * Сэтгэгдэл/үнэлгээ — шат дараалсан хариу, санал өгөх, спойлер, мэдээлэх.
 *
 * ⚠️ ЗАРЧИМ:
 *   • Үндсэн сэтгэгдэл (parentId=null) — нэг хэрэглэгч нэг кинонд НЭГ, үнэлгээтэй
 *   • Хариу (parentId≠null) — хязгааргүй, үнэлгээгүй (rating=0)
 *   • Дундаж үнэлгээ тооцоход ЗӨВХӨН үндсэн сэтгэгдэл ороно
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Нийтэд харагдах шүүлт — нуугдсаныг хасна */
  private readonly visible = { isHidden: false };

  /**
   * Үндсэн сэтгэгдлийн unique түлхүүр.
   *
   * ⚠️ `parentKey` ("" = үндсэн) ашиглана, `parentId` (NULL) БИШ. Учир нь SQL-д
   * NULL ≠ NULL тул NULL-тай compound unique нь хамгаалдаггүй — нэг хэрэглэгч
   * нэг кинонд хэдэн ч сэтгэгдэл бичиж чадах алдаа гардаг (бодитоор туршиж
   * баталсан).
   */
  private rootKey(userId: string, titleId: string) {
    return { userId, titleId, parentKey: '' };
  }

  /**
   * Тухайн киноны сэтгэгдлүүд — хариу болон саналын тоотой.
   * `userId` дамжуулбал тухайн хэрэглэгчийн өгсөн саналыг ч буцаана.
   */
  async list(
    titleId: string,
    opts: { page?: number; limit?: number; sort?: ReviewSort; userId?: string } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
    const sort = opts.sort ?? 'helpful';

    const where = { titleId, parentId: null, ...this.visible };

    // "Хэрэгтэй" эрэмбэ нь тооцоолсон талбар тул кодоор эрэмбэлнэ
    const orderBy =
      sort === 'newest'
        ? { createdAt: 'desc' as const }
        : sort === 'oldest'
          ? { createdAt: 'asc' as const }
          : sort === 'highest'
            ? { rating: 'desc' as const }
            : sort === 'lowest'
              ? { rating: 'asc' as const }
              : { createdAt: 'desc' as const }; // helpful — доор дахин эрэмбэлнэ

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        // helpful үед бүх мөрийг авч кодоор эрэмбэлэх боломжгүй тул
        // хуудаслалт хэвээр — "хэрэгтэй" нь хуудсан доторх эрэмбэ
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatarKey: true } },
          votes: { select: { userId: true, value: true } },
          replies: {
            where: this.visible,
            orderBy: { createdAt: 'asc' },
            take: 20,
            include: {
              user: { select: { id: true, name: true, avatarKey: true } },
              votes: { select: { userId: true, value: true } },
              _count: { select: { replies: true } },
            },
          },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const shape = (r: (typeof rows)[number] | (typeof rows)[number]['replies'][number]) => {
      const votes = r.votes ?? [];
      const helpful = votes.filter((v) => v.value === 1).length;
      const notHelpful = votes.filter((v) => v.value === -1).length;
      return {
        id: r.id,
        userId: r.userId,
        user: r.user,
        rating: r.rating,
        comment: r.comment,
        hasSpoiler: r.hasSpoiler,
        isStaff: r.isStaff,
        parentId: r.parentId,
        helpful,
        notHelpful,
        score: helpful - notHelpful,
        /** Уншиж буй хэрэглэгчийн өгсөн санал (1 | -1 | 0) */
        myVote: opts.userId ? (votes.find((v) => v.userId === opts.userId)?.value ?? 0) : 0,
        replyCount: r._count?.replies ?? 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    };

    let items = rows.map((r) => ({
      ...shape(r),
      replies: r.replies.map(shape),
    }));

    // "Хамгийн хэрэгтэй" — оноогоор, тэнцвэл шинэ нь дээр
    if (sort === 'helpful') {
      items = items.sort(
        (a, b) => b.score - a.score || +new Date(b.createdAt) - +new Date(a.createdAt),
      );
    }

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Одны тархалт (1-10 бүрд хэдэн хүн өгсөн) — график зурахад */
  async stats(titleId: string) {
    const rows = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { titleId, parentId: null, ...this.visible },
      _count: { rating: true },
    });

    const distribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) distribution[i] = 0;
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      if (r.rating >= 1 && r.rating <= 10) {
        distribution[r.rating] = r._count.rating;
        sum += r.rating * r._count.rating;
        count += r._count.rating;
      }
    }

    return {
      average: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      count,
      distribution,
    };
  }

  /** Үндсэн сэтгэгдэл нэмэх/шинэчлэх (нэг хэрэглэгч нэг удаа) */
  async upsert(
    userId: string,
    titleId: string,
    dto: { rating: number; comment?: string; hasSpoiler?: boolean },
  ) {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      select: { id: true },
    });
    if (!title) throw new NotFoundException('Кино олдсонгүй');

    const comment = (dto.comment ?? '').trim().slice(0, MAX_COMMENT);

    return this.prisma.review.upsert({
      where: { userId_titleId_parentKey: this.rootKey(userId, titleId) },
      create: {
        userId,
        titleId,
        rating: dto.rating,
        comment,
        hasSpoiler: dto.hasSpoiler ?? false,
      },
      update: { rating: dto.rating, comment, hasSpoiler: dto.hasSpoiler ?? false },
    });
  }

  /** Сэтгэгдэлд хариу бичих (үнэлгээгүй) */
  async reply(
    userId: string,
    parentId: string,
    dto: { comment: string; hasSpoiler?: boolean },
    isAdmin = false,
  ) {
    const parent = await this.prisma.review.findUnique({
      where: { id: parentId },
      select: { id: true, titleId: true, parentId: true, isHidden: true },
    });
    if (!parent || parent.isHidden) throw new NotFoundException('Сэтгэгдэл олдсонгүй');
    // ⚠️ Зөвхөн 2 давхар — хариун дээр хариу бичихэд эх сэтгэгдэлд холбоно
    const rootId = parent.parentId ?? parent.id;

    const comment = (dto.comment ?? '').trim().slice(0, MAX_COMMENT);
    if (!comment) throw new BadRequestException('Хариу хоосон байж болохгүй');

    return this.prisma.review.create({
      data: {
        userId,
        titleId: parent.titleId,
        parentId: rootId,
        // ⚠️ Хариунд parentKey-г ӨВӨРМӨЦ болгоно — эс бөгөөс нэг хүн нэг
        // сэтгэгдэлд ЗӨВХӨН НЭГ хариу бичиж чадна (unique саад болно).
        parentKey: `r:${rootId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        rating: 0, // хариунд үнэлгээ байхгүй
        comment,
        hasSpoiler: dto.hasSpoiler ?? false,
        isStaff: isAdmin,
      },
      include: { user: { select: { id: true, name: true, avatarKey: true } } },
    });
  }

  /** Санал өгөх / буцаах (дахин дарвал цуцлагдана) */
  async vote(userId: string, reviewId: string, value: 1 | -1) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });
    if (!review) throw new NotFoundException('Сэтгэгдэл олдсонгүй');
    if (review.userId === userId) {
      throw new BadRequestException('Өөрийн сэтгэгдэлд санал өгөх боломжгүй');
    }

    const existing = await this.prisma.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });

    if (existing?.value === value) {
      // Ижил товч дахин → цуцлана
      await this.prisma.reviewVote.delete({ where: { reviewId_userId: { reviewId, userId } } });
    } else {
      await this.prisma.reviewVote.upsert({
        where: { reviewId_userId: { reviewId, userId } },
        create: { reviewId, userId, value },
        update: { value },
      });
    }

    /**
     * ⚠️⚠️ DB талд ТООЛНО — бүх саналыг санах ойд татахгүй.
     *
     * Өмнө нь хоёрхон тоо гаргахын тулд тухайн сэтгэгдлийн БҮХ санлын
     * мөрийг уншдаг байв. Олон санал авсан сэтгэгдэлд санал өгөх бүрд
     * мянга мянган мөр санах ойд ачаалагдана.
     */
    const [helpful, notHelpful, mine] = await Promise.all([
      this.prisma.reviewVote.count({ where: { reviewId, value: 1 } }),
      this.prisma.reviewVote.count({ where: { reviewId, value: -1 } }),
      /* ⚠️ Зөвхөн ӨӨРИЙН саналыг татна — бүх мөрийг шүүхийн оронд */
      this.prisma.reviewVote.findFirst({
        where: { reviewId, userId },
        select: { value: true },
      }),
    ]);
    return {
      helpful,
      notHelpful,
      score: helpful - notHelpful,
      myVote: mine?.value ?? 0,
    };
  }

  /** Тохиромжгүй гэж мэдээлэх */
  async report(userId: string, reviewId: string, reason: string, note?: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });
    if (!review) throw new NotFoundException('Сэтгэгдэл олдсонгүй');
    if (review.userId === userId) {
      throw new BadRequestException('Өөрийн сэтгэгдлийг мэдээлэх боломжгүй');
    }

    const existing = await this.prisma.reviewReport.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });
    if (existing) return { ok: true, already: true };

    // ⚠️ Мэдээлэл + тоолуур нэг transaction-д (тоо зөрөхгүй)
    await this.prisma.$transaction([
      this.prisma.reviewReport.create({
        data: { reviewId, userId, reason, note: (note ?? '').slice(0, 500) },
      }),
      this.prisma.review.update({
        where: { id: reviewId },
        data: { reportCount: { increment: 1 } },
      }),
    ]);

    return { ok: true };
  }

  async myReview(userId: string, titleId: string) {
    return this.prisma.review.findUnique({
      where: { userId_titleId_parentKey: this.rootKey(userId, titleId) },
    });
  }

  /** Өөрийн сэтгэгдэл/хариу устгах (админ бол бусдынхыг ч) */
  async removeOwn(userId: string, reviewId: string, role: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });
    if (!review) return { ok: true };
    if (review.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('Зөвхөн өөрийн сэтгэгдлийг устгана');
    }
    await this.prisma.review.delete({ where: { id: reviewId } }).catch(() => null);
    return { ok: true };
  }

  /** Хуучин API нийцтэй байдал — киногоор устгах */
  async remove(userId: string, titleId: string) {
    await this.prisma.review
      .delete({ where: { userId_titleId_parentKey: this.rootKey(userId, titleId) } })
      .catch(() => null);
    return { ok: true };
  }

  // ─── Админ ────────────────────────────────────────────────────────────────

  async adminList(params: {
    q?: string;
    rating?: number;
    page?: number;
    limit?: number;
    onlyReported?: boolean;
    onlyHidden?: boolean;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 20);

    const where = {
      ...(params.rating ? { rating: Number(params.rating) } : {}),
      ...(params.onlyReported ? { reportCount: { gt: 0 } } : {}),
      ...(params.onlyHidden ? { isHidden: true } : {}),
      ...(params.q
        ? {
            OR: [
              { comment: { contains: params.q, mode: 'insensitive' as const } },
              { title: { title: { contains: params.q, mode: 'insensitive' as const } } },
              { user: { name: { contains: params.q, mode: 'insensitive' as const } } },
              { user: { email: { contains: params.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total, reportedTotal] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: params.onlyReported
          ? [{ reportCount: 'desc' }, { createdAt: 'desc' }]
          : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          title: { select: { id: true, title: true, slug: true } },
          reports: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { reason: true, note: true, createdAt: true },
          },
          _count: { select: { replies: true, votes: true } },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.count({ where: { reportCount: { gt: 0 }, isHidden: false } }),
    ]);

    return { items, total, reportedTotal, page, totalPages: Math.ceil(total / limit) };
  }

  /** Устгахгүйгээр нуух/буцаах */
  async adminSetHidden(id: string, isHidden: boolean) {
    await this.prisma.review.update({ where: { id }, data: { isHidden } }).catch(() => null);
    return { ok: true, isHidden };
  }

  /** Мэдээллийг цэвэрлэх (зөв сэтгэгдэл гэж шийдсэн) */
  async adminClearReports(id: string) {
    await this.prisma.$transaction([
      this.prisma.reviewReport.deleteMany({ where: { reviewId: id } }),
      this.prisma.review.update({ where: { id }, data: { reportCount: 0 } }),
    ]);
    return { ok: true };
  }

  async adminRemove(id: string) {
    // ⚠️ `.catch(() => null)` БАЙХГҮЙ — алдаа нуувал хэрэглэгч "устгагдлаа"
    // гэсэн мэдэгдэл авах мөртлөө мөр хэвээр үлдэж эргэлздэг
    const exists = await this.prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Сэтгэгдэл олдсонгүй');
    await this.prisma.review.delete({ where: { id } });
    return { ok: true };
  }

  async adminBulkRemove(ids: string[]) {
    const res = await this.prisma.review.deleteMany({ where: { id: { in: ids } } });
    return { ok: true, count: res.count };
  }
}
