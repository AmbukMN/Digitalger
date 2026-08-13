import { Injectable, Logger } from '@nestjs/common';
import { DiscountType, Prisma, PromotionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

/**
 * УРАМШУУЛЛЫН ТООЦОО.
 *
 * ⚠️⚠️ ЭНЭ ФАЙЛ НЬ МӨНГӨ ТООЦДОГ. Алдаа гарвал хэрэглэгч дутуу
 * төлж эсвэл илүү авна. Бүх тооцоо ЭНД төвлөрнө — frontend нь
 * зөвхөн ХАРУУЛНА, дахин тооцохгүй (хоёр газар тооцвол зөрнө).
 *
 * ХЭРЭГЛЭГЧИЙН ТАЛД БОДОХ ДҮРЭМ: хэд хэдэн урамшуулал тохирвол
 * ХАМГИЙН АШИГТАЙГ нь автоматаар сонгоно.
 */

/** Багцад тохирсон урамшууллын үр дүн — frontend-д харуулах хэлбэр */
export interface AppliedPromotion {
  id: string;
  name: string;
  shortText: string;
  type: PromotionType;
  /** Эцсийн үнэ (хямдрал тусгасан) */
  finalPrice: number;
  /** Хямдралгүй үнэ — зураастай харуулна. Хямдралгүй бол `finalPrice`-тэй тэнцүү */
  originalPrice: number;
  /** Нийт хоног (үндсэн + бонус) */
  totalDays: number;
  /** Нэмэлт хоног (0 бол нэмэлт байхгүй) */
  bonusDays: number;
  /** Бэлэг багцын нэр (GIFT_PLAN) */
  giftPlanName: string | null;
  /** Энэ урамшуулал купонтой давхарлах уу */
  blockCoupons: boolean;
  endsAt: Date;
}

/** Хэтэвч цэнэглэх бонус */
export interface WalletBonus {
  id: string;
  name: string;
  shortText: string;
  minTopup: number;
  bonusAmount: number;
  endsAt: Date;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * ⚠️ ИДЭВХТЭЙ гэдгийн тодорхойлолт — 3 нөхцөл ЗЭРЭГ:
   *   1. `isActive` (админ унтраагаагүй)
   *   2. Одоо нь `startsAt`–`endsAt` хооронд
   *   3. `maxUses` хүрээгүй
   *
   * Хугацаа дуусмагц АВТОМАТААР алга болно — админ гараар унтраах
   * шаардлагагүй (мартвал хэт удаан ажиллана).
   */
  private activeWhere(): Prisma.PromotionWhereInput {
    const now = new Date();
    return {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    };
  }

  /** `maxUses` хүрсэн эсэх — DB-д нөхцөлөөр илэрхийлэх боломжгүй тул кодоор */
  private hasQuota(p: { maxUses: number | null; usedCount: number }): boolean {
    return p.maxUses === null || p.usedCount < p.maxUses;
  }

  /**
   * Тухайн хэрэглэгчид БАГЦ БҮРД тохирох ХАМГИЙН САЙН урамшууллыг олно.
   *
   * @param userId нэвтрээгүй бол null — `newUsersOnly` болон `maxPerUser`
   *   шалгалт хийхгүй (зочинд урамшууллыг ХАРУУЛНА, худалдан авах үед
   *   дахин шалгагдана). Эс бөгөөс зочин үнийг өндөр хараад буцна.
   */
  async forPlans(
    plans: { id: string; price: number; durationDays: number }[],
    userId: string | null,
  ): Promise<Map<string, AppliedPromotion>> {
    const result = new Map<string, AppliedPromotion>();
    if (plans.length === 0) return result;

    const promos = await this.prisma.promotion.findMany({
      where: {
        ...this.activeWhere(),
        /* WALLET_BONUS нь багцад хамааралгүй */
        type: { not: PromotionType.WALLET_BONUS },
      },
      include: {
        plans: { select: { planId: true } },
        giftPlan: { select: { name: true } },
      },
      orderBy: { order: 'asc' },
    });
    if (promos.length === 0) return result;

    /**
     * ⚠️ Хэрэглэгчийн ашиглалтыг НЭГ query-ээр — багц бүрд тусад нь
     * шалгавал N+1 болно (10 багц × 5 урамшуулал = 50 query).
     */
    const used = new Map<string, number>();
    let isNewUser = true;
    if (userId) {
      const [rows, purchases] = await Promise.all([
        this.prisma.promotionRedemption.groupBy({
          by: ['promotionId'],
          where: { userId, promotionId: { in: promos.map((p) => p.id) } },
          _count: { promotionId: true },
        }),
        this.prisma.payment.count({
          where: { userId, status: 'PAID', planId: { not: null } },
        }),
      ]);
      for (const r of rows) used.set(r.promotionId, r._count.promotionId);
      isNewUser = purchases === 0;
    }

    for (const plan of plans) {
      let best: AppliedPromotion | null = null;

      for (const promo of promos) {
        if (!this.hasQuota(promo)) continue;
        /* Хоосон `plans` = БҮХ багцад */
        if (promo.plans.length > 0 && !promo.plans.some((x) => x.planId === plan.id)) continue;
        if (userId && promo.newUsersOnly && !isNewUser) continue;
        if (userId && (used.get(promo.id) ?? 0) >= promo.maxPerUser) continue;

        const applied = this.apply(promo, plan);
        if (!applied) continue;

        /* ⚠️ ХАМГИЙН АШИГТАЙГ сонгоно — хэрэглэгчийн талд */
        if (!best || this.valueOf(applied, plan) > this.valueOf(best, plan)) {
          best = applied;
        }
      }

      if (best) result.set(plan.id, best);
    }

    return result;
  }

  /**
   * Урамшууллын «ашиг»-ийг НЭГ ТООГООР илэрхийлнэ — харьцуулахад.
   *
   * ⚠️ Хугацаа ба мөнгийг харьцуулахын тулд хоногийг ₮ болгоно:
   * нэг хоногийн үнэ = багцын үнэ / хоног. Ингэснээр «30% хямдрал»
   * болон «1 сар бэлэг» шударгаар харьцуулагдана.
   */
  private valueOf(a: AppliedPromotion, plan: { price: number; durationDays: number }): number {
    const perDay = plan.durationDays > 0 ? plan.price / plan.durationDays : 0;
    const saved = a.originalPrice - a.finalPrice;
    return saved + a.bonusDays * perDay;
  }

  /** Нэг урамшууллыг нэг багцад тооцно */
  private apply(
    promo: {
      id: string;
      name: string;
      shortText: string;
      type: PromotionType;
      bonusDays: number | null;
      discountType: DiscountType | null;
      discountValue: number | null;
      giftDays: number | null;
      giftPlan: { name: string } | null;
      blockCoupons: boolean;
      endsAt: Date;
    },
    plan: { price: number; durationDays: number },
  ): AppliedPromotion | null {
    const base: AppliedPromotion = {
      id: promo.id,
      name: promo.name,
      shortText: promo.shortText,
      type: promo.type,
      finalPrice: plan.price,
      originalPrice: plan.price,
      totalDays: plan.durationDays,
      bonusDays: 0,
      giftPlanName: null,
      blockCoupons: promo.blockCoupons,
      endsAt: promo.endsAt,
    };

    switch (promo.type) {
      case PromotionType.EXTRA_DAYS: {
        if (!promo.bonusDays || promo.bonusDays <= 0) return null;
        return {
          ...base,
          bonusDays: promo.bonusDays,
          totalDays: plan.durationDays + promo.bonusDays,
        };
      }

      case PromotionType.DISCOUNT: {
        if (!promo.discountType || !promo.discountValue) return null;
        const off =
          promo.discountType === DiscountType.PERCENT
            ? Math.floor((plan.price * promo.discountValue) / 100)
            : promo.discountValue;
        /**
         * ⚠️ ҮНЭ 0-ЭЭС ДООШ БУУХГҮЙ. FIXED хямдрал нь багцын үнээс
         * их байвал сөрөг үнэ гарч, QPay нэхэмжлэл үүсгэхэд унана.
         * ⚠️ Доод хязгаар 100₮ — 0₮ төлбөр нь QPay-д хүчингүй.
         */
        const finalPrice = Math.max(100, plan.price - off);
        if (finalPrice >= plan.price) return null; // хямдрал үр дүнгүй
        return { ...base, finalPrice };
      }

      case PromotionType.GIFT_PLAN: {
        if (!promo.giftPlan) return null;
        return { ...base, giftPlanName: promo.giftPlan.name };
      }

      default:
        return null;
    }
  }

  /** Хэтэвч цэнэглэх бонус — дүнд тохирохыг олно (хамгийн өндөр бонус) */
  async walletBonusFor(amount: number, userId: string | null): Promise<WalletBonus | null> {
    const promos = await this.prisma.promotion.findMany({
      where: { ...this.activeWhere(), type: PromotionType.WALLET_BONUS },
      orderBy: { order: 'asc' },
    });

    let best: WalletBonus | null = null;
    for (const p of promos) {
      if (!this.hasQuota(p)) continue;
      if (!p.minTopup || !p.bonusAmount) continue;
      if (amount < p.minTopup) continue;

      if (userId) {
        const used = await this.prisma.promotionRedemption.count({
          where: { promotionId: p.id, userId },
        });
        if (used >= p.maxPerUser) continue;
      }

      if (!best || p.bonusAmount > best.bonusAmount) {
        best = {
          id: p.id,
          name: p.name,
          shortText: p.shortText,
          minTopup: p.minTopup,
          bonusAmount: p.bonusAmount,
          endsAt: p.endsAt,
        };
      }
    }
    return best;
  }

  /**
   * Урамшууллыг АШИГЛАСАН гэж бүртгэнэ (төлбөр амжилттай болмогц).
   *
   * ⚠️⚠️ ТРАНЗАКЦ ДОТОР дуудагдана — `usedCount` нэмэгдэх ба
   * redemption бичигдэх нь ЗААВАЛ хамт болно. Салангид бол
   * тоолуур зөрж, хязгаар хэтэрнэ.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    promotionId: string,
    userId: string,
    paymentId: string | null,
    valueGiven: number,
    daysGiven: number,
  ): Promise<void> {
    await tx.promotion.update({
      where: { id: promotionId },
      data: { usedCount: { increment: 1 } },
    });
    await tx.promotionRedemption.create({
      data: { promotionId, userId, paymentId, valueGiven, daysGiven },
    });
  }

  /**
   * Нүүр хуудасны баннер болгох урамшууллууд.
   * ⚠️ Зөвхөн `bannerKey`-тэй нь — зураггүй урамшуулал баннер болохгүй.
   */
  async banners() {
    const rows = await this.prisma.promotion.findMany({
      where: { ...this.activeWhere(), bannerKey: { not: null } },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        shortText: true,
        bannerKey: true,
        bannerMobileKey: true,
        endsAt: true,
        maxUses: true,
        usedCount: true,
      },
    });

    return Promise.all(
      rows
        .filter((r) => this.hasQuota(r))
        .map(async (r) => ({
          id: r.id,
          name: r.name,
          shortText: r.shortText,
          imageUrl: await this.storage.publicAssetUrl(r.bannerKey!, 7200),
          mobileImageUrl: r.bannerMobileKey
            ? await this.storage.publicAssetUrl(r.bannerMobileKey, 7200)
            : null,
          endsAt: r.endsAt,
        })),
    );
  }
}
