import { NotFoundException } from '@nestjs/common';

/**
 * ⚠️⚠️ САЙТ ХООРОНД БИЧИХЭЭС ХАМГААЛАХ ТУСЛАХ.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *
 * Prisma-ийн site өргөтгөл нь `update`/`delete`-д `where` шүүлт
 * НЭМДЭГГҮЙ — unique op тул түлхүүрийг хөндөж болохгүй. Зөвхөн
 * `findUnique`-ийн ҮР ДҮНГ post-filter хийдэг. Тиймээс:
 *
 *     await prisma.plan.update({ where: { id }, data });
 *
 * гэсэн мөр нь **ямар ч сайтын** мөрийг өөрчилнө.
 *
 * БОДИТ АЛДАА (2026-09-08, агентын тестээр илэрсэн):
 *   PATCH /admin/plans/<bestfilm-ийн-id>  +  X-Site: besttv
 *   → 200, багцын нэр «ZZBUG_HACKED_BY_BESTTV», үнэ 99999 болсон
 *   DELETE /admin/chat-keywords/<bestfilm-ийн-id> + X-Site: besttv
 *   → 200, БОДИТООР устсан (эргэлт буцалтгүй)
 *
 * ⚠️ 9 админ endpoint-д ижил цоорхой байсан.
 *
 * ХЭРЭГЛЭХ:
 *
 *     await assertSameSite(this.prisma.plan, id, 'Багц олдсонгүй');
 *     return this.prisma.plan.update({ where: { id }, data });
 *
 * `findFirst` нь site шүүлтийг АВТОМАТААР авдаг тул мөр нөгөө
 * сайтынх бол `null` буцаж, 404 шидэгдэнэ.
 *
 * ⚠️ `findUnique` ХЭРЭГЛЭХГҮЙ — түүний `select`-д `site` байхгүй бол
 * post-filter алгасагддаг (тусдаа аудит бий).
 */

/** Prisma моделийн наад захын интерфейс — `findFirst` байхад хангалттай */
interface HasFindFirst {
  findFirst(args: { where: { id: string }; select: { id: true } }): Promise<{ id: string } | null>;
}

/**
 * Мөр нь ОДООГИЙН сайтынх эсэхийг батална.
 *
 * @throws NotFoundException — өөр сайтынх эсвэл огт байхгүй бол
 */
export async function assertSameSite(
  model: HasFindFirst,
  id: string,
  message = 'Олдсонгүй',
): Promise<void> {
  const row = await model.findFirst({ where: { id }, select: { id: true } });
  if (!row) throw new NotFoundException(message);
}
