'use client';

import { toast } from 'sonner';
import { api, getAccessToken, tryRefresh } from './api';

/**
 * BestTV файл байршуулах НЭГДСЭН helper.
 *
 * Онцлог:
 *   • Бодит явц (%) — XHR `upload.onprogress` (fetch нь progress өгдөггүй)
 *   • Progress toast — зөвхөн ТОМ файлд (жижигт шуугиан болно)
 *   • ЦУЦЛАХ боломжтой — `abort()` (DigitalGer-т байхгүй)
 *   • Сервэрийн ДЕТАЛЬТАЙ алдааг харуулна ("яагаад" гэдгийг мэдэхгүй байхаас сэргийлнэ)
 */

/** Энэ хэмжээнээс дээш файлд progress toast гарна */
const PROGRESS_TOAST_THRESHOLD = 3 * 1024 * 1024; // 3MB

export interface UploadResult {
  key: string;
  url: string;
}

export interface UploadHandle<T> {
  promise: Promise<T>;
  /** Дундаас нь зогсооно */
  abort: () => void;
}

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * XHR upload — явц + цуцлах боломжтой.
 *
 * ⚠️ 401 үед ТОКЕН ШИНЭЧЛЭЭД ДАХИН оролдоно. Access token 15 минутын настай
 * тул админ модал удаан нээлттэй байгаад upload дархад "Authentication
 * required" гээд унадаг байв (`api()`-д refresh байсан ч XHR тусдаа зам).
 */
async function xhrUpload(
  url: string,
  method: 'POST' | 'PUT',
  body: File | FormData,
  opts: {
    onProgress?: (percent: number) => void;
    auth?: boolean;
    signal?: { xhr: XMLHttpRequest | null };
  } = {},
): Promise<string> {
  try {
    return await xhrOnce(url, method, body, opts);
  } catch (e) {
    /**
     * ⚠️ Зөвхөн 401-д — бусад алдаанд дахин оролдвол давхар upload болно.
     * ⚠️ `instanceof` БИШ, ТАЛБАРААР шалгана: production build-д класс нэр
     *    минифай хийгдэж, тусдаа chunk-д хуулагдвал `instanceof` худал
     *    буцаадаг (яг ийм шалтгаанаар refresh ажиллахгүй байсан).
     */
    const status = (e as { status?: number })?.status;
    if (status !== 401 || opts.auth === false) throw e;
    const ok = await tryRefresh();
    if (!ok) throw new Error('Нэвтрэлт дууссан — дахин нэвтэрнэ үү');
    return xhrOnce(url, method, body, opts);
  }
}

/** HTTP статустай алдаа — 401-ийг найдвартай таних (минифайд ч ажиллана) */
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function xhrOnce(
  url: string,
  method: 'POST' | 'PUT',
  body: File | FormData,
  opts: {
    onProgress?: (percent: number) => void;
    auth?: boolean;
    signal?: { xhr: XMLHttpRequest | null };
  } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (opts.signal) opts.signal.xhr = xhr; // цуцлахад ашиглана

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        // ⚠️ Серверийн жинхэнэ мессежийг гаргана (ерөнхий текстээр дарахгүй)
        let msg = `Алдаа (${xhr.status})`;
        try {
          const b = JSON.parse(xhr.responseText);
          msg = Array.isArray(b?.message) ? b.message.join(', ') : (b?.message ?? msg);
        } catch {
          /* JSON биш — статус кодоор л мэдэгдэнэ */
        }
        // ⚠️ Статусыг ТАЛБАРААР дамжуулна — дээд түвшин 401-ийг таниад
        //    токен шинэчилж дахин оролдоно (минифайд ч найдвартай)
        reject(new HttpError(xhr.status, msg));
      }
    };
    xhr.onerror = () => reject(new Error('Сүлжээний алдаа'));
    xhr.ontimeout = () => reject(new Error('Хугацаа хэтэрлээ'));
    xhr.onabort = () => reject(new DOMException('Цуцлагдлаа', 'AbortError'));

    xhr.open(method, url);
    if (opts.auth !== false) {
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(body);
  });
}

/** Toast-ыг явцаар шинэчилнэ (нэг id дээр дарж бичих) */
function makeToastTracker(file: File) {
  const show = file.size >= PROGRESS_TOAST_THRESHOLD;
  const id = show ? `upload-${Date.now()}-${Math.random()}` : undefined;
  const size = humanSize(file.size);

  if (id) {
    toast.loading(`Байршуулж байна... 0% — ${file.name} (${size})`, {
      id,
      duration: Infinity,
    });
  }

  return {
    id,
    onProgress: id
      ? (p: number) => {
          // ⚠️ 100%-д зогсооно: сүлжээгээр илгээгдсэн ч сервер боловсруулж
          // байгаа тул "100%" гээд гацсан мэт харагдахаас сэргийлнэ
          const label = p >= 100 ? 'Боловсруулж байна...' : `Байршуулж байна... ${p}%`;
          toast.loading(`${label} — ${file.name} (${size})`, { id, duration: Infinity });
        }
      : undefined,
    success: (msg = 'Байршуулагдлаа') => {
      if (id) toast.success(`${msg} — ${file.name}`, { id, duration: 2500 });
    },
    error: (e: unknown) => {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const detail = e instanceof Error ? e.message : 'Алдаа гарлаа';
      if (id) {
        if (isAbort) toast.info(`Цуцлагдлаа — ${file.name}`, { id, duration: 2000 });
        else toast.error(`${detail} — ${file.name}`, { id, duration: 5000 });
      } else if (!isAbort) {
        toast.error(detail);
      }
    },
  };
}

/**
 * ЗУРАГ байршуулах — backend-ээр дамжина (сервер дээр WebP болгож хувиргана).
 *
 * @param kind poster | backdrop | gallery | cast | cover | og ...
 */
export function uploadImage(
  file: File,
  kind: string,
  onProgress?: (p: number) => void,
): UploadHandle<UploadResult> {
  const signal: { xhr: XMLHttpRequest | null } = { xhr: null };
  const t = makeToastTracker(file);

  const promise = (async () => {
    // Client талын шалгалт — сервер хүртэл явахгүйгээр шууд мэдэгдэнэ
    if (!file.type.startsWith('image/')) {
      const err = new Error('Зөвхөн зураг файл байршуулна уу');
      t.error(err);
      throw err;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const url = apiBase
        ? `${apiBase}/api/admin/uploads/image`
        : '/api/admin/uploads/image';

      const text = await xhrUpload(url, 'POST', form, {
        onProgress: (p) => {
          onProgress?.(p);
          t.onProgress?.(p);
        },
        signal,
      });
      const res = JSON.parse(text) as UploadResult;
      t.success('Зураг байршуулагдлаа');
      return res;
    } catch (e) {
      t.error(e);
      throw e;
    }
  })();

  return { promise, abort: () => signal.xhr?.abort() };
}

/**
 * ВИДЕО байршуулах — R2 горимд browser-оос ШУУД R2 руу (presigned PUT).
 * Backend-ээр дамжуулбал том файлд Node-ийн socket buffer унадаг (ENOBUFS).
 *
 * Upload дуусмагц HLS хөрвүүлэлт queue-д орно — тоглуулахад БЭЛЭН БИШ.
 */
export function uploadVideo(
  file: File,
  target: { target: 'trailer' | 'movie' | 'episode'; targetId: string },
  onProgress?: (p: number) => void,
): UploadHandle<{ rawKey: string }> {
  const signal: { xhr: XMLHttpRequest | null } = { xhr: null };
  const t = makeToastTracker(file);

  const promise = (async () => {
    if (!file.type.startsWith('video/')) {
      const err = new Error('Зөвхөн видео файл байршуулна уу');
      t.error(err);
      throw err;
    }

    try {
      const { mode } = await api<{ mode: 'local' | 'r2' }>('/admin/uploads/video/init', {
        method: 'POST',
      });

      let rawKey: string;
      const track = (p: number) => {
        onProgress?.(p);
        t.onProgress?.(p);
      };

      if (mode === 'r2') {
        const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
          '/admin/uploads/video/presign',
          { method: 'POST', body: JSON.stringify({ fileName: file.name }) },
        );
        // ⚠️ R2 presigned URL — Authorization header ИЛГЭЭХГҮЙ (signature эвдэрнэ)
        await xhrUpload(uploadUrl, 'PUT', file, { onProgress: track, auth: false, signal });
        rawKey = key;
      } else {
        // Локал драйвер — backend руу ШУУД (Next rewrite том файлд гацдаг)
        // ⚠️ localhost fallback БАЙХГҮЙ — production дээр буруу хаяг руу
        // хандаж эвдэрдэг байсан. Хоосон бол харьцангуй зам (Next rewrite).
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        const form = new FormData();
        form.append('file', file);
        const text = await xhrUpload(`${apiBase}/api/admin/uploads/video/direct`, 'POST', form, {
          onProgress: track,
          signal,
        });
        rawKey = (JSON.parse(text) as { key: string }).key;
      }

      await api('/admin/uploads/video/complete', {
        method: 'POST',
        body: JSON.stringify({ ...target, rawKey }),
      });

      t.success('Видео орлоо — HLS хөрвүүлж байна');
      return { rawKey };
    } catch (e) {
      t.error(e);
      throw e;
    }
  })();

  return { promise, abort: () => signal.xhr?.abort() };
}
