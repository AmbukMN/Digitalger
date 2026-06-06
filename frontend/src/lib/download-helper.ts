'use client';

// ─── Файл татах + In-app browser илрүүлэлт ─────────────────────────────────
//
// Татах нь ердийн <a download>-аар ажиллана. FB/IG доторх браузараас хэрэглэгч
// login/төлбөрийн өмнө системийн браузар (Safari/Chrome) руу шилжсэн байх тул
// татах үед үргэлж ердийн браузарт байна — FB WebView-д татах асуудал гарахгүй.
// (isInAppBrowser зэрэг илрүүлэлтийг browser-switch логик ашигладаг.)

/** Facebook/Instagram/Messenger/TikTok зэрэг апп доторх браузер эсэхийг шалгана. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|musical_ly|TikTok/i.test(ua);
}

/** Тухайн in-app browser-ийн нэрийг буцаана (зөвлөгөөнд харуулахад). */
export function inAppBrowserName(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return 'Facebook';
  if (/musical_ly|TikTok/i.test(ua)) return 'TikTok';
  if (/Line\//i.test(ua)) return 'Line';
  return null;
}

/** iOS төхөөрөмж эсэх. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Android төхөөрөмж эсэх. */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Presigned URL-аас файл татна — ердийн <a download>. Браузар (desktop/mobile)
 * өөрөө R2-аас шууд татна тул серверт ачаалал өгөхгүй, том файл ч аюулгүй.
 */
export function triggerFileDownload(url: string, fileName: string) {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
