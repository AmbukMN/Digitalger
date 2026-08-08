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
