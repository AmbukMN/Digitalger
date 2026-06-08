import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const COMMENT_MAX = 2000;

export interface CreateReviewInput {
  rating: number;
  comment?: string;
  authorName?: string;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
  authorName?: string;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  // rating 1-5 бүхэл тоо эсэхийг шалгах
  private validateRating(rating: unknown): number {
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new BadRequestException('Үнэлгээ 1-ээс 5 хооронд байх ёстой');
    }
    return r;
  }

  // comment цэвэрлэх + урт хязгаар (2000)
  private normalizeComment(comment?: string): string | null {
    const c = (comment ?? '').trim();
    if (!c) return null;
    if (c.length > COMMENT_MAX) {
      throw new BadRequestException(`Сэтгэгдэл хэт урт байна (хамгийн ихдээ ${COMMENT_MAX} тэмдэгт)`);
    }
    return c;
  }

  // authorName цэвэрлэх (хоосон бол null → user.name fallback createReview дотор)
  private normalizeAuthorName(authorName?: string): string | null {
    const n = (authorName ?? '').trim();
    if (!n) return null;
    if (n.length > 100) {
      throw new BadRequestException('Нэр хэт урт байна');
    }
    return n;
  }

  // slug эсвэл id-аар product олох → productId буцаах
  private async resolveProductId(productSlugOrId: string): Promise<string> {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ slug: productSlugOrId }, { id: productSlugOrId }] },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Бүтээгдэхүүн олдсонгүй');
    return product.id;
  }

  // product.rating (AVG) + ratingCount (COUNT) дахин тооцох.
  // create/update/delete болгонд (хэрэглэгч ба admin аль алинд) дуудна.
  async recalcProductRating(productId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    // дундажийг 2 орон болгож дугуйлна (4.3333 → 4.33)
    const avg = count > 0 ? Math.round((agg._avg.rating ?? 0) * 100) / 100 : 0;
    await this.prisma.product.update({
      where: { id: productId },
      data: { rating: avg, ratingCount: count },
    });
  }

  // ─── Public CRUD ──────────────────────────────────────────────────────────────

  // Нэг хэрэглэгч нэг бүтээгдэхүүнд нэг review (upsert). Байвал шинэчилнэ.
  async createReview(userId: string, productSlugOrId: string, input: CreateReviewInput) {
    const productId = await this.resolveProductId(productSlugOrId);
    const rating = this.validateRating(input.rating);
    const comment = this.normalizeComment(input.comment);
    let authorName = this.normalizeAuthorName(input.authorName);

    // authorName хоосон бол хэрэглэгчийн нэрийг fallback болгоно
    if (!authorName) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      authorName = (user?.name ?? '').trim() || null;
    }

    const review = await this.prisma.review.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, rating, comment, authorName },
      update: { rating, comment, authorName },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    await this.recalcProductRating(productId);
    return review;
  }

  // Зөвхөн өөрийн review засна.
  async updateReview(userId: string, reviewId: string, input: UpdateReviewInput) {
    const existing = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true, productId: true },
    });
    if (!existing) throw new NotFoundException('Сэтгэгдэл олдсонгүй');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Зөвхөн өөрийн сэтгэгдлийг засах боломжтой');
    }

    const data: { rating?: number; comment?: string | null; authorName?: string | null } = {};
    if (input.rating !== undefined) data.rating = this.validateRating(input.rating);
    if (input.comment !== undefined) data.comment = this.normalizeComment(input.comment);
    if (input.authorName !== undefined) data.authorName = this.normalizeAuthorName(input.authorName);

    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data,
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    await this.recalcProductRating(existing.productId);
    return review;
  }

  // Зөвхөн өөрийн review устгана.
  async deleteReview(userId: string, reviewId: string) {
    const existing = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true, productId: true },
    });
    if (!existing) throw new NotFoundException('Сэтгэгдэл олдсонгүй');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Зөвхөн өөрийн сэтгэгдлийг устгах боломжтой');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.recalcProductRating(existing.productId);
    return { success: true };
  }

  // Pagination жагсаалт (10/хуудас), сүүлийнх эхэнд + rating breakdown.
  async listReviews(
    productSlugOrId: string,
    opts: { page?: number; pageSize?: number } = {},
  ) {
    const productId = await this.resolveProductId(productSlugOrId);
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));
    const skip = (page - 1) * pageSize;

    const [items, total, grouped] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { user: { select: { id: true, name: true, image: true } } },
      }),
      this.prisma.review.count({ where: { productId } }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId },
        _count: { _all: true },
      }),
    ]);

    // breakdown: { 5: n, 4: n, 3: n, 2: n, 1: n }
    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const g of grouped) {
      if (g.rating >= 1 && g.rating <= 5) breakdown[g.rating] = g._count._all;
    }

    return { items, total, page, pageSize, breakdown };
  }

  // Хэрэглэгчийн өөрийн review (засахад UI-д урьдчилж дүүргэх).
  async getMyReview(userId: string, productSlugOrId: string) {
    const productId = await this.resolveProductId(productSlugOrId);
    return this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
      include: { user: { select: { id: true, name: true, image: true } } },
    });
  }
}
