/**
 * ФОРМАТЛАГЧ — locale-аас ХАМААРАХГҮЙ.
 *
 * ⚠️⚠️ `toLocaleString('mn-MN')` ХЭРЭГЛЭХГҮЙ. Android дээрх Hermes нь
 * анхдагчаар ICU-гүй build хийгддэг тул `mn-MN` чимээгүй `en-US`-руу
 * унана: мөнгө таслалгүй, огноо «8/30/2026» гэж англи хэлбэрээр гарна.
 * iOS дээр зөв, Android дээр буруу — тестээр анзаарагдахад хэцүү.
 *
 * Тиймээс ICU-д ОГТ найдахгүй, гараар форматлана.
 */

/**
 * Мөнгө — мянгатыг таслалаар.
 * @example money(1234567) // "1,234,567"
 */
export function money(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  const neg = v < 0;
  /* ⚠️ Regex нь БҮХ гурвалыг олохын тулд lookahead — энгийн replace
     нь зөвхөн эхнийхийг солино */
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg ? `-${s}` : s;
}

/** Мөнгө + төгрөгийн тэмдэг */
export function mnt(n: number | null | undefined): string {
  return `${money(n)}₮`;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * Огноо — Монголд түгээмэл «2026.08.30» хэлбэр.
 *
 * ⚠️ Буруу/хоосон огноо ирвэл ХООСОН мөр буцаана — «Invalid Date»
 * гэж хэрэглэгчид харуулах нь эвдэрсэн мэт харагдана.
 */
export function date(d: string | number | Date | null | undefined): string {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}.${p2(x.getMonth() + 1)}.${p2(x.getDate())}`;
}

/** Огноо + цаг — «2026.08.30 14:05» */
export function dateTime(d: string | number | Date | null | undefined): string {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${date(x)} ${p2(x.getHours())}:${p2(x.getMinutes())}`;
}

/**
 * Харьцангуй хугацаа — мэдэгдэлд «5 минутын өмнө».
 *
 * ⚠️ 7 хоногоос хойш бол бүтэн огноо — «43 хоногийн өмнө» гэдэг нь
 * уншихад хэцүү.
 */
export function ago(d: string | number | Date | null | undefined): string {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const sec = Math.floor((Date.now() - x.getTime()) / 1000);
  if (sec < 60) return 'дөнгөж сая';
  if (sec < 3600) return `${Math.floor(sec / 60)} минутын өмнө`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} цагийн өмнө`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} хоногийн өмнө`;
  return date(x);
}
