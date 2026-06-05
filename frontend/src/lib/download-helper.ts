'use client';

// ─── Файл татах туслах + In-app browser илрүүлэлт ──────────────────────────
//
// АСУУДАЛ: Facebook / Instagram / Messenger зэрэг апп доторх браузер (in-app
// WebView) нь файл татахыг хязгаарладаг:
//   · `<a download>` attribute-ийг ДЭМДЭГГҮЙ
//   · шинэ таб / popup нээхийг блоклодог
// Тиймээс эдгээр браузерт татах товч "Page not found" болж унадаг.
//
// ШИЙДЭЛ:
//   1. triggerFileDownload — ердийн браузерт `<a download>`, in-app браузерт
//      шууд `window.location.href` ашиглана (presigned URL руу navigate).
//   2. isInAppBrowser — FB/IG/Messenger/TikTok зэрэг in-app browser илрүүлж,
//      хэрэглэгчид "гадаад браузер дээр нээ" гэж зөвлөхөд ашиглана.

/** Facebook/Instagram/Messenger/TikTok зэрэг апп доторх браузер эсэхийг шалгана. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // FBAN/FBAV = Facebook, Instagram, Messenger (FB_IAB), Line, TikTok
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

/** iOS төхөөрөмж эсэх (зөвлөгөөний текст ялгахад). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Presigned URL-аас файл татна. In-app browser-т `<a download>` ажилладаггүй
 * тул шууд navigate хийнэ (Content-Disposition: attachment header нь браузерыг
 * татахад хүргэнэ). Ердийн браузерт `<a download>` ашиглана.
 */
export function triggerFileDownload(url: string, fileName: string) {
  if (typeof document === 'undefined') return;

  if (isInAppBrowser()) {
    // In-app browser: `<a download>` ажиллахгүй тул URL руу шууд navigate.
    // Backend presigned URL дээр Content-Disposition: attachment байгаа тул
    // браузер файлыг татаж эхэлнэ (хуудас "алга болохгүй").
    window.location.href = url;
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
