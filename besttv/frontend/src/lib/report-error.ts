/**
 * BROWSER-ИЙН АЛДААГ СЕРВЕР РҮҮ МЭДЭЭЛЭХ.
 *
 * ⚠️⚠️ ЯАГААД: «зарим хэрэглэгч үзэж чадахгүй байна» гэсэн гомдол ирэхэд
 * ЯМАР алдаа, ЯМАР төхөөрөмж дээр гарсныг мэдэх арга ОГТ БАЙГААГҮЙ.
 * Browser талын алдаа хаана ч үлддэггүй байв.
 *
 * ⚠️ ХЭЗЭЭ Ч ШИДЭХГҮЙ — мэдээлэх үйлдэл өөрөө унавал хэрэглэгчийн
 *    үндсэн урсгал тасрах ёсгүй.
 */

/**
 * ⚠️ ДАВХАРДЛААС хамгаална: нэг алдаа секундэд олон удаа давтагдвал
 * (жишээ: render гогцоо) сервер рүү мянган хүсэлт явахгүй.
 */
const sent = new Map<string, number>();
const DEDUPE_MS = 60_000;

export function reportError(
  message: string,
  opts?: { stack?: string; path?: string; meta?: Record<string, unknown> },
) {
  try {
    if (typeof window === 'undefined') return;

    const key = message.slice(0, 120);
    const last = sent.get(key) ?? 0;
    if (Date.now() - last < DEDUPE_MS) return;
    sent.set(key, Date.now());
    /* ⚠️ Map хязгааргүй өсөхөөс сэргийлнэ */
    if (sent.size > 50) sent.clear();

    const body = JSON.stringify({
      source: 'client',
      message: message.slice(0, 500),
      stack: opts?.stack?.slice(0, 4000),
      path: opts?.path ?? window.location.pathname,
      meta: {
        ...opts?.meta,
        ua: navigator.userAgent.slice(0, 300),
        online: navigator.onLine,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });

    /**
     * ⚠️ `keepalive` — хэрэглэгч хуудсаа хаах агшинд ч хүсэлт явна
     *    (эс бөгөөс хамгийн чухал алдаа яг тэр үед алдагдана).
     */
    void fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* Сүлжээгүй үед мэдээлэх боломжгүй — чимээгүй өнгөрнө */
    });
  } catch {
    /* Мэдээлэх нь ХЭЗЭЭ Ч апп-ыг унагаах ёсгүй */
  }
}

/**
 * Глобал алдаа сонсогч — баригдаагүй алдаа + promise rejection.
 * ⚠️ Нэг л удаа суулгана (`layout` дотор дуудагдана).
 */
let installed = false;

export function installErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportError(e.message || 'Unknown error', {
      stack: e.error?.stack,
      meta: { kind: 'window.error', file: e.filename, line: e.lineno },
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportError(
      typeof r === 'string' ? r : (r?.message ?? 'Unhandled promise rejection'),
      { stack: r?.stack, meta: { kind: 'unhandledrejection' } },
    );
  });
}
