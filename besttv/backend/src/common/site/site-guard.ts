import { NotFoundException } from '@nestjs/common';
import { currentSite } from './site-context';

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

/**
 * ⚠️⚠️ MULTI-SITE МОДЕЛИЙН (`Title`) МӨР ЭНЭ САЙТАД БАЙГАА ЭСЭХ.
 *
 * ⛔ БОДИТ ЭРСДЭЛ (2026-09-09 аудит): `site-extension.ts`-ийн
 * post-filter нь `Array.isArray(row.sites)` шалгадаг — өөрөөр хэлбэл
 * `select`-д `sites` ОРУУЛААГҮЙ бол `undefined` болж шалгалт
 * ЧИМЭЭГҮЙ АЛГАСАГДАНА. Энэ бол fail-OPEN загвар.
 *
 * Нөлөөлсөн: stream playlist/variant/thumbnails, downloads, subtitles —
 * өөрөөр хэлбэл нөгөө сайтад нийтлээгүй киног урсгах/татах боломжтой
 * байв. Одоогоор 257/257 кино хоёуланд нь тул далд, ГЭВЧ админ
 * нэг товч дарангуут амьд эмзэг байдал болно.
 *
 * ХЭРЭГЛЭХ — `findUnique`-ийн `select`-д `sites: true` нэмээд:
 *
 *     assertTitleOnSite(title.sites, 'Кино олдсонгүй');
 *
 * ⚠️ `sites` нь `undefined` ирвэл ч ШИДНЭ (fail-closed) — дуудагч
 * `select`-д нэмэхээ мартвал чимээгүй өнгөрөхгүй.
 */
export function assertTitleOnSite(
  sites: string[] | undefined | null,
  message = 'Олдсонгүй',
): void {
  if (!Array.isArray(sites) || !sites.includes(currentSite())) {
    throw new NotFoundException(message);
  }
}
