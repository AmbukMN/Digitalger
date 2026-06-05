'use client';

// ─── Файл татах туслах + In-app browser илрүүлэлт ──────────────────────────
//
// АСУУДАЛ: Facebook / Instagram / Messenger зэрэг апп доторх браузер (in-app
// WebView) нь файл татахыг хязгаарладаг:
//   · `<a download>` attribute-ийг ДЭМДЭГГҮЙ
//   · шинэ таб / popup нээхийг блоклодог
//   · presigned URL руу navigate хийхэд "Page not found" болж унадаг
//
// ШИЙДЭЛ (in-app browser үед):
//   iOS  → `x-safari-https://...` scheme-ээр Safari-д шууд нээхийг оролдоно.
//   Android → `intent://...#Intent;...end` scheme-ээр Chrome-д нээхийг оролдоно.
//   Хэрэв scheme ажиллахгүй бол (хэрэглэгч хэвээр FB браузерт) → дуудагч тал
//   modal харуулж "Safari-д нээ" гэж зааварчилна (triggerFileDownload-ийн
//   буцаах утга false бол modal харуул).

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
 * In-app browser-аас системийн браузер (Safari/Chrome) руу URL-ийг нээхийг
 * ОРОЛДоно. iOS → x-safari-https scheme, Android → intent scheme.
 * Эдгээр scheme нь зарим in-app browser-т ажилладаг (FB зэрэг). Ажиллах эсэхийг
 * JS мэдэх боломжгүй тул дуудагч тал нэмж заавар (modal) харуулах нь зүйтэй.
 */
export function openInExternalBrowser(url: string): void {
  if (typeof window === 'undefined') return;
  if (isIOS()) {
    // iOS Safari-руу үсрэх scheme — FB/IG WebView-аас Safari нээдэг.
    window.location.href = `x-safari-${url}`;
    return;
  }
  if (isAndroid()) {
    // Android Chrome intent — https URL-ийг гадаад browser-т нээнэ.
    const noScheme = url.replace(/^https?:\/\//, '');
    window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }
  // Бусад → энгийн navigate (fallback)
  window.location.href = url;
}

// In-app browser үед татах боломжгүй болсныг бүх хуудсанд мэдэгдэх global event.
// Layout-д суусан InAppBrowserModalHost үүнийг сонсож, заавар modal харуулна.
export const IN_APP_DOWNLOAD_EVENT = 'dg:inapp-download-blocked';

/**
 * Presigned URL-аас файл татна.
 *  · Ердийн браузер → `<a download>` (хэвийн татна).
 *  · In-app browser → системийн браузар руу нээхийг оролдоод (x-safari/intent),
 *    global event ялгаруулж заавар modal харуулна. `false` буцаана.
 * @returns true = ердийн татах эхэлсэн, false = in-app (заавар харуулсан)
 */
export function triggerFileDownload(url: string, fileName: string): boolean {
  if (typeof document === 'undefined') return false;

  if (isInAppBrowser()) {
    // Системийн браузар руу нээхийг оролдоно (зарим FB браузерт ажиллана).
    openInExternalBrowser(url);
    // Ажиллахгүй бол хэрэглэгч FB браузерт үлдэх тул заавар modal-ийг
    // global event-ээр асаана (бүх дуудагч талд автоматаар хүчинтэй).
    window.dispatchEvent(new CustomEvent(IN_APP_DOWNLOAD_EVENT, { detail: { url } }));
    return false;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
