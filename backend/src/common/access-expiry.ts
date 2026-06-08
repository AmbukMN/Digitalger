/**
 * Хандалтын хугацаа (access expiry) тооцох нэгдсэн helper (DRY).
 *
 * Product.accessType:
 *   - "LIFETIME" → насан туршийн (Order.expiresAt = null, хэзээ ч дуусахгүй)
 *   - "DAYS"     → accessDays хоногийн дараа дуусна
 *
 * Order.expiresAt:
 *   - null    → насан туршийн (LIFETIME)
 *   - DateTime → түүнээс хойш хандалт дуусна
 *
 * БҮХ entitlement зам (downloads, courses) болон PAID болгодог БҮХ газар
 * (payments.completePayment, free order, ADMIN_GRANT) энэ helper-ийг ашиглана.
 */

/** Захиалга PAID болох үед expiresAt тооцоход хэрэгтэй product талбарууд. */
export interface AccessProductLike {
  accessType?: string | null;
  accessDays?: number | null;
}

/**
 * Захиалгад буй бүтээгдэхүүнүүдээс expiresAt-ийг тооцно.
 *
 * Логик (хэрэглэгчид ХАМГИЙН ЭЭЛТЭЙ — хамгийн их хугацаа):
 *   - Аль нэг бүтээгдэхүүн LIFETIME байвал → null (насан туршийн давамгайлна).
 *   - Бүгд DAYS бол → paidAt + MAX(accessDays) (хамгийн урт хугацааг авна).
 *   - accessDays байхгүй/буруу DAYS бол насан туршийн (null) гэж үзнэ (аюулгүй тал).
 *
 * @param products захиалгын item-уудын product (accessType/accessDays)
 * @param paidAt   төлбөр баталгаажсан огноо (expiresAt-ийн суурь)
 * @returns expiresAt (Date) эсвэл null (насан туршийн)
 */
export function computeOrderExpiresAt(
  products: AccessProductLike[],
  paidAt: Date,
): Date | null {
  if (!products?.length) return null;

  let maxDays = 0;
  for (const p of products) {
    // LIFETIME (эсвэл accessType заагаагүй) аль нэг байвал → насан туршийн.
    if (!p?.accessType || p.accessType === 'LIFETIME') {
      return null;
    }
    if (p.accessType === 'DAYS') {
      const days = Number(p.accessDays);
      // DAYS гэсэн ч хоног буруу/тэг бол хязгаарлахгүй (насан туршийн — аюулгүй тал).
      if (!Number.isFinite(days) || days <= 0) {
        return null;
      }
      if (days > maxDays) maxDays = days;
    } else {
      // Үл мэдэгдэх accessType — хязгаарлахгүй (насан туршийн).
      return null;
    }
  }

  if (maxDays <= 0) return null;
  return new Date(paidAt.getTime() + maxDays * 24 * 60 * 60 * 1000);
}

/** Захиалга шиг expiresAt талбартай объект (entitlement шалгалтад). */
export interface ExpiringOrderLike {
  expiresAt?: Date | null;
}

/**
 * Захиалгын хандалт ИДЭВХТЭЙ эсэх: expiresAt null (насан туршийн) ЭСВЭЛ ирээдүйд.
 * @param order  expiresAt талбартай захиалга
 * @param now    одоо (default: шинэ Date)
 */
export function isActiveOrder(order: ExpiringOrderLike, now: Date = new Date()): boolean {
  return !order.expiresAt || order.expiresAt > now;
}

/**
 * Захиалгуудаас хамгийн сонгомол ИДЭВХТЭЙ нэгийг олно (entitlement-д).
 * Идэвхтэй (null/future) байвал тэдгээрээс хамгийн урт хүчинтэйг (null хамгийн дээд)
 * сонгоно. Идэвхтэй огт байхгүй бол null буцаана (бүгд дууссан).
 */
export function pickActiveOrder<T extends ExpiringOrderLike>(
  orders: T[],
  now: Date = new Date(),
): T | null {
  const active = orders.filter((o) => isActiveOrder(o, now));
  if (!active.length) return null;
  // null (насан туршийн) хамгийн дээд тэргүүлэх; эс бол хамгийн хожуу expiresAt.
  return active.reduce((best, cur) => {
    if (!best.expiresAt) return best;
    if (!cur.expiresAt) return cur;
    return cur.expiresAt > best.expiresAt ? cur : best;
  });
}
