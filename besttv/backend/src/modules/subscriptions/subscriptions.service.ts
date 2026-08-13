import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Идэвхтэй эрхтэй эсэх — ямар нэг багцтай эсэхийн энгийн шалгалт */
  async hasActive(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return !!sub;
  }

  /**
   * Хэрэглэгчийн ИДЭВХТЭЙ БҮХ багцаас нээгдэх хандалт.
   * Хэрэглэгч олон багц зэрэг авч болно (Монгол + Солонгос гэх мэт).
   *  - vip: true бол БҮХ жанрын контент нээгдэнэ
   *  - genreIds: тухайн хэрэглэгчид нээлттэй жанруудын ID
   */
  async accessScope(
    userId: string | null | undefined,
  ): Promise<{ vip: boolean; genreIds: Set<string> }> {
    if (!userId) return { vip: false, genreIds: new Set() };

    const subs = await this.prisma.subscription.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        plan: {
          select: {
            isVip: true,
            genres: { select: { genreId: true } },
          },
        },
      },
    });

    const genreIds = new Set<string>();
    let vip = false;
    for (const s of subs) {
      if (s.plan.isVip) vip = true;
      for (const g of s.plan.genres) genreIds.add(g.genreId);
    }
    return { vip, genreIds };
  }

  /**
   * Тухайн контентыг үзэх эрхтэй эсэх — багц ↔ жанрын хандалтаар шалгана.
   * Контент нь өөрийн жанруудын АЛЬ НЭГЭНД нь эрхтэй бол нээгдэнэ.
   */
  /**
   * Контент үзэх эрхтэй эсэх.
   *
   * ⚠️ Гурван зам: (1) VIP багц → (2) жанрын багц → (3) ТУХАЙН КИНОГ
   * ширхэгээр түрээсэлсэн (хугацаа дуусаагүй). Аль нэг нь таарвал үзнэ.
   */
  async canAccessTitle(
    userId: string | null | undefined,
    titleGenreIds: string[],
    titleId?: string,
  ): Promise<boolean> {
    const { vip, genreIds } = await this.accessScope(userId);
    if (vip) return true;
    if (genreIds.size > 0 && titleGenreIds.some((id) => genreIds.has(id))) return true;

    // Багцгүй ч энэ киног түрээсэлсэн байж болно
    if (userId && titleId) return this.hasActiveRental(userId, titleId);
    return false;
  }

  /** Тухайн кинонд хүчинтэй түрээстэй эсэх */
  async hasActiveRental(userId: string, titleId: string): Promise<boolean> {
    const rental = await this.prisma.rental.findFirst({
      where: { userId, titleId, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return !!rental;
  }

  /** Идэвхтэй түрээс (хугацаа харуулахад) */
  async activeRental(userId: string, titleId: string) {
    return this.prisma.rental.findFirst({
      where: { userId, titleId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      select: { id: true, expiresAt: true, amount: true },
    });
  }

  async activeSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      include: { plan: true },
    });
  }

  /** Профайл/UI-д харуулах — идэвхтэй бүх багц */
  async activeSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      include: { plan: { select: { id: true, name: true, isVip: true } } },
    });
  }

  /**
   * Төлбөр баталгаажсаны дараа эрх нээх/сунгах.
   * Идэвхтэй эрх байвал ДЭЭР нь залгаж сунгана (давхарлахгүй, алдагдахгүй).
   */
  /**
   * ⚠️ `paymentId` нь NULL байж БОЛНО — урамшууллын БЭЛЭГ БАГЦ нь
   * төлбөргүй олгогддог (`Subscription.paymentId` нь схемд `String?`).
   */
  async grant(
    userId: string,
    planId: string,
    durationDays: number,
    paymentId: string | null,
  ) {
    const now = new Date();
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { isVip: true },
    });

    // ⚠️ ЗӨВХӨН ижил багцын үлдэгдэл дээр залгана — өөр багцын дуусах
    // огнооноос эхлүүлбэл хугацаа буруу уртасна
    const sameActive = await this.prisma.subscription.findFirst({
      where: { userId, planId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    });
    const startsAt = sameActive ? sameActive.expiresAt : now;
    const expiresAt = new Date(startsAt.getTime() + durationDays * 86400_000);

    return this.prisma.$transaction(async (tx) => {
      /**
       * ⚠️ VIP-ийн ОНЦГОЙ ДҮРЭМ (админ олголттой ижил):
       *   VIP авбал → бусад багц хүчингүй (илүүдэл)
       *   VIP байхад энгийн багц авбал → VIP хүчингүй
       * Ингэснээр хэрэглэгчийн эрх ҮРГЭЛЖ тодорхой байна.
       */
      if (plan?.isVip) {
        await tx.subscription.updateMany({
          where: { userId, expiresAt: { gt: now }, plan: { isVip: false } },
          data: { expiresAt: now },
        });
      } else {
        await tx.subscription.updateMany({
          where: { userId, expiresAt: { gt: now }, plan: { isVip: true } },
          data: { expiresAt: now },
        });
      }

      return tx.subscription.create({
        data: { userId, planId, startsAt, expiresAt, paymentId },
      });
    });
  }
}
