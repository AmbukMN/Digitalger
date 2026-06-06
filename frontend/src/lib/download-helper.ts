'use client';

// ─── Файл татах + In-app browser илрүүлэлт ─────────────────────────────────
//
// Татах нь ердийн <a download>-аар ажиллана. FB/IG доторх браузараас хэрэглэгч
// login/төлбөрийн өмнө системийн браузар (Safari/Chrome) руу шилжсэн байх тул
// татах үед үргэлж ердийн браузарт байна — FB WebView-д татах асуудал гарахгүй.
// (isInAppBrowser зэрэг илрүүлэлтийг browser-switch логик ашигладаг.)

/**
 * Апп доторх браузер (in-app WebView) эсэхийг шалгана. Эдгээр нь файл татах/
 * төлбөр хийхийг хязгаарладаг + тусдаа cookie орчинтой. Facebook, Instagram,
 * Messenger, TikTok, Line, Twitter/X, WeChat, Telegram, Snapchat, LinkedIn,
 * Pinterest, KakaoTalk зэргийг хамруулна.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Тодорхой токенуудаар л шалгана (false-positive-аас сэргийлж). "Twitter" нь
  // "Twitter for iPhone/Android" гэж бодит in-app browser-т ирдэг — дангаараа
  // ерөнхий тул "Twitter for"-оор шалгана.
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|musical_ly|TikTok|Twitter for|LinkedInApp|MicroMessenger|Snapchat|Pinterest\/|KAKAOTALK/i.test(ua);
}

/** Тухайн in-app browser-ийн нэрийг буцаана (зөвлөгөөнд харуулахад). */
export function inAppBrowserName(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return 'Facebook';
  if (/musical_ly|TikTok/i.test(ua)) return 'TikTok';
  if (/Twitter for/i.test(ua)) return 'Twitter';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  if (/Snapchat/i.test(ua)) return 'Snapchat';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
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
 *
 * FB/IG доторх браузар нь файл татаж чаддаггүй ("Page not found"). Хэрэглэгч
 * library-д шууд орж татвал (browser-switch хийгээгүй) эвдрэхээс сэргийлж: FB/IG
 * илэрвэл татахгүй, BROWSER_SWITCH_EVENT ялгаруулна → layout-д суусан host
 * системийн браузар руу шилжих modal харуулна.
 */
export function triggerFileDownload(url: string, fileName: string) {
  if (typeof document === 'undefined') return;
  if (isInAppBrowser()) {
    // Шилжихдээ ОДООГИЙН хуудсыг targetPath болгоно — library бол /library
    // (нэвтэрсэн), product бол /products/slug (зочин үнэгүй татах ч ажиллана).
    // /library hardcode хийвэл зочин нэвтрэх шаардсан хуудсанд гацна.
    const here = window.location.pathname + window.location.search;
    window.dispatchEvent(new CustomEvent(BROWSER_SWITCH_EVENT, { detail: { targetPath: here } }));
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// FB/IG доторх браузарт татах/нэвтрэх боломжгүй болсныг бүх хуудсанд мэдэгдэх
// global event. Layout-д суусан BrowserSwitchHost үүнийг сонсож шилжих modal
// харуулна — татах товч бүрт modal нэмэх шаардлагагүй.
export const BROWSER_SWITCH_EVENT = 'dg:browser-switch';
