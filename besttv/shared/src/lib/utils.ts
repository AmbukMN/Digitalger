import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) + '₮';
}

/**
 * Байтыг хүн уншихуйц болгоно (1.4 GB, 218 MB…).
 *
 * ⚠️ НЭГ ЭХ СУРВАЛЖ — өмнө нь `storage-usage-card` (fmtBytes) болон
 * `lib/upload` (humanSize) гэсэн ХОЁР ЗЭРЭГЦЭЭ хувилбар байсан.
 * Гурав дахийг үүсгэхгүйн тулд энд төвлөрүүлэв.
 *
 * 100-аас дээш эсвэл байт үед бутархай ХАРУУЛАХГҮЙ (1.4 GB, 218 MB,
 * 512 B) — жагсаалтад цэвэрхэн харагдана.
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Ангийн харагдах нэр.
 *
 * ⚠️⚠️ НЭГ ЭХ СУРВАЛЖ — өмнө нь ГУРВАН газарт `${ep.number}. ${ep.name ??
 * \`Анги ${ep.number}\`}` гэж давхардсан байв (кино дэлгэрэнгүй, үзэх
 * хуудасны жагсаалт, "Дараагийн анги" товч). Тэр хэв нь нэргүй ангийг
 * `1. Анги 1` гэж ДУГААРЫГ ХОЁР УДАА бичдэг байсан.
 *
 * Нэртэй  → "3. Эцсийн тулаан"
 * Нэргүй  → "3-р анги"
 */
export function episodeLabel(number: number, name?: string | null): string {
  return name?.trim() ? `${number}. ${name.trim()}` : `${number}-р анги`;
}

/**
 * Түрээс дуусах хүртэлх хугацаа — "2 өдөр 3 цаг", "12 цаг 30 мин".
 *
 * ⚠️⚠️ НЭГ ЭХ СУРВАЛЖ — өмнө нь `title-detail-client.tsx`
 * (`formatRentLeft`) болон `profile/page.tsx` (`rentLeft`) хоёрт мөр
 * мөрөөрөө ижил хуулагдсан байв. Нэгийг нь зассан үед киноны хуудас
 * ба профайл ӨӨР хугацаа харуулж, хэрэглэгч аль нь үнэн болохыг
 * мэдэхгүй болно.
 *
 * ⚠️ ӨДӨР нэмэв: түрээс ихэвчлэн 48 цаг тул хуучин хувилбар "47 цаг
 * 12 мин" гэж харуулдаг байсныг хүн ойлгоход хэцүү.
 */
export function formatRentLeft(expiresAt: string | Date): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0 мин';

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);

  if (d > 0) return `${d} өдөр ${h} цаг`;
  return h > 0 ? `${h} цаг ${m} мин` : `${m} мин`;
}

/**
 * Огноо — «2026.08.15» (цаггүй).
 *
 * ⚠️⚠️ НЭГ ЭХ СУРВАЛЖ — админ панелд огноо ГУРВАН өөр хэлбэрээр
 * харагдаж байв: `toLocaleString()` (44 газар), `toLocaleDateString('mn-MN')`
 * (22), `toLocaleString('mn-MN')` (19).
 *
 * Хамгийн ноцтой нь `toLocaleString()` — локалыг ЗААЖ ӨГӨӨГҮЙ тул
 * хөтчийн тохиргооноос хамаарна. Англи локалтай компьютер дээр
 * «8/15/2026» гэж АМЕРИК хэлбэрээр гарч, 8-р сарын 15 мөн үү, эсвэл
 * 15-р сарын 8 мөн үү гэдэг нь ойлгомжгүй болно (төлбөрийн жагсаалтад
 * бодит эргэлзээ).
 *
 * ⚠️ `sv-SE` локал — ISO-той ижил `2026-08-15` өгдөг цорын ганц
 * стандарт локал. Түүнийг цэгээр солиод монгол хэлбэрт оруулна.
 */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('sv-SE').replace(/-/g, '.');
}

/** Огноо + цаг — «2026.08.15 14:30» */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('mn-MN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatDate(date)} ${time}`;
}

/**
 * Харьцангуй хугацаа — «5 минутын өмнө», «3 хоногийн өмнө».
 *
 * ⚠️ Жагсаалтад «саяхан юу болсныг» хурдан ойлгоход. 7 хоногоос
 * хойш бол бүтэн огноо руу шилжинэ — «47 хоногийн өмнө» гэдэг нь
 * «2026.07.01»-ээс дутуу мэдээлэлтэй.
 */
export function formatRelative(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';

  const diff = Date.now() - date.getTime();
  if (diff < 0) return formatDateTime(date);

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'дөнгөж сая';
  if (mins < 60) return `${mins} минутын өмнө`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} хоногийн өмнө`;

  return formatDate(date);
}
