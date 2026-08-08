'use client';

import { toast } from 'sonner';
import { api, clearTokens, getAccessToken, tryRefresh } from './api';

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

    /**
     * ⚠️ Refresh амжилтгүй бол ХЭРЭГЛЭГЧИД ОЙЛГОМЖТОЙ хэлнэ.
     * Өмнө нь серверийн "Authentication required" гэсэн ерөнхий мессеж
     * гарч, админ юу хийхээ мэдэхгүй байв. Одоо шалтгаан + үйлдлийг
     * хэлж, 1.5 секундын дараа нэвтрэх хуудас руу автоматаар шилжүүлнэ.
     */
    const ok = await tryRefresh();
    if (!ok) {
      clearTokens();
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.href = '/login';
      }, 1500);
      throw new Error('Нэвтрэлтийн хугацаа дууслаа — дахин нэвтэрч байна...');
    }
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
      /**
       * ⚠️⚠️ SAME-ORIGIN ЗААВАЛ — `/api/...` (Next rewrite backend руу дамжуулна).
       *
       * Өмнө нь `NEXT_PUBLIC_API_URL` (https://api.besttv.us) ашиглаж
       * CROSS-ORIGIN болгодог байсан. Тэр үед browser preflight хийж,
       * зарим орчинд `Authorization` header алдагдаж 401 буцдаг байв.
       *
       * Нотолгоо: нэг агшинд `/api/admin/titles` (same-origin) → 200, харин
       * `api.besttv.us/api/admin/uploads/image` (cross-origin) → 401.
       * Ижил токен, ижил хэрэглэгч — зөвхөн origin л ялгаатай.
       */
      const text = await xhrUpload('/api/admin/uploads/image', 'POST', form, {
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
 * MULTIPART байршуулалт — том видеонд (5 GB+).
 *
 * ⚠️⚠️ ЯАГААД: ганц presigned PUT нь S3/R2-ийн дүрмээр 5 GB-аас том
 * биетийг ХҮЛЭЭЖ АВДАГГҮЙ. Манай кинонууд дунджаар 4.2 GB, дээд нь
 * 7.4 GB тул тэдгээр нь ЧИМЭЭГҮЙ УНАДАГ байв.
 *
 * ⚠️ Хэсэг унавал ТҮҮНИЙГ л дахин илгээнэ — 7 GB файлын сүүлийн хэсэг
 * дээр унаад эхнээс нь эхлэх нь хүлээн зөвшөөрөхгүй.
 *
 * ⚠️ Алдаа гарвал `abort` ЗААВАЛ — дуусаагүй хэсгүүд R2-д үлдэж
 * ТӨЛБӨР төлүүлнэ.
 */
async function uploadVideoMultipart(
  file: File,
  onProgress: (percent: number) => void,
  signal: { xhr: XMLHttpRequest | null },
): Promise<string> {
  /** ⚠️ 100 MB — PUT тоо ба дахин илгээх эрсдэлийн тэнцвэр */
  const PART_SIZE = 100 * 1024 * 1024;
  /** Нэг хэсэг хэдэн удаа дахин оролдох */
  const PART_RETRIES = 3;
  /** ⚠️ Зэрэг илгээх хэсгийн тоо — сүлжээг дүүргэхгүй, гэхдээ хурдан */
  const CONCURRENCY = 3;

  const { key, uploadId } = await api<{ key: string; uploadId: string }>(
    '/admin/uploads/video/multipart/init',
    { method: 'POST', body: JSON.stringify({ fileName: file.name }) },
  );

  const partCount = Math.ceil(file.size / PART_SIZE);
  const parts: { ETag: string; PartNumber: number }[] = [];
  /* ⚠️ Явцыг БАЙТААР тоолно — хэсгийн тоогоор бол сүүлийн хэсэг жижиг
     байхад хувь үсэрдэг */
  let uploadedBytes = 0;

  try {
    /* Presigned URL-уудыг багцаар авна (50-аар) — хэсэг бүрд нэг дуудалт
       хийвэл 7 GB файлд 70+ удаа сервер рүү очно */
    const urlMap = new Map<number, string>();
    for (let from = 1; from <= partCount; from += 50) {
      const nums = Array.from(
        { length: Math.min(50, partCount - from + 1) },
        (_, i) => from + i,
      );
      const { urls } = await api<{ urls: { partNumber: number; url: string }[] }>(
        '/admin/uploads/video/multipart/urls',
        { method: 'POST', body: JSON.stringify({ key, uploadId, partNumbers: nums }) },
      );
      for (const u of urls) urlMap.set(u.partNumber, u.url);
    }

    /** Нэг хэсгийг илгээх — дахин оролдлоготой */
    const sendPart = async (partNumber: number) => {
      const start = (partNumber - 1) * PART_SIZE;
      const blob = file.slice(start, Math.min(start + PART_SIZE, file.size));
      const url = urlMap.get(partNumber)!;

      for (let attempt = 1; attempt <= PART_RETRIES; attempt++) {
        try {
          const etag = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url);
            /* ⚠️ Authorization ИЛГЭЭХГҮЙ — R2 presign signature эвдэрнэ */
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                /* ⚠️ ETag нь хашилттай ирдэг — `complete`-д ТЭР ЧИГЭЭР нь
                   явуулна, хасвал R2 татгалзана */
                const tag = xhr.getResponseHeader('ETag');
                tag ? resolve(tag) : reject(new Error('ETag ирсэнгүй'));
              } else {
                reject(Object.assign(new Error(`HTTP ${xhr.status}`), { status: xhr.status }));
              }
            };
            xhr.onerror = () => reject(new Error('Сүлжээний алдаа'));
            xhr.onabort = () => reject(new Error('Цуцлагдлаа'));
            signal.xhr = xhr;
            xhr.send(blob);
          });
          uploadedBytes += blob.size;
          onProgress(Math.min(99, Math.round((uploadedBytes / file.size) * 100)));
          return { ETag: etag, PartNumber: partNumber };
        } catch (e) {
          if (attempt === PART_RETRIES) throw e;
          /* ⚠️ Өсөн нэмэгдэх хүлээлт — түр саатал дээр шууд дахин
             оролдвол мөн унана */
          await new Promise((r) => setTimeout(r, attempt * 3000));
        }
      }
      throw new Error(`Хэсэг ${partNumber} илгээгдсэнгүй`);
    };

    /* ⚠️ Хязгаартай зэрэгцээ — бүгдийг зэрэг илгээвэл browser болон
       сүлжээ дүүрч бүгд удаашрана */
    const queue = Array.from({ length: partCount }, (_, i) => i + 1);
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, partCount) }, async () => {
        for (;;) {
          const n = queue.shift();
          if (n === undefined) return;
          parts.push(await sendPart(n));
        }
      }),
    );

    await api('/admin/uploads/video/multipart/complete', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, parts }),
    });
    onProgress(100);
    return key;
  } catch (e) {
    /* ⚠️ Цуцлахгүй бол дуусаагүй хэсгүүд R2-д үлдэж төлбөр төлүүлнэ */
    await api('/admin/uploads/video/multipart/abort', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId }),
    }).catch(() => null);
    throw e;
  }
}

/**
 * ВИДЕО байршуулах — R2 горимд browser-оос ШУУД R2 руу (multipart).
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
        /**
         * ⚠️⚠️ MULTIPART — ХЭМЖЭЭНИЙ ХЯЗГААР АРИЛСАН.
         *
         * Өмнө нь ганц presigned PUT байсан нь S3/R2-ийн дүрмээр
         * 5 GB-аас том биетийг ХҮЛЭЭЖ АВДАГГҮЙ тул 7.4 GB кино
         * ЧИМЭЭГҮЙ УНАДАГ байв. Одоо 100 MB хэсгээр илгээнэ —
         * практикт хязгааргүй (10,000 × 100 MB ≈ 1 TB).
         */
        rawKey = await uploadVideoMultipart(file, track, signal);
      } else {
        // ⚠️ SAME-ORIGIN — зурагтай ижил шалтгаан (cross-origin preflight
        //    дээр Authorization алдагдаж 401 буцдаг). Next rewrite дамжуулна.
        const form = new FormData();
        form.append('file', file);
        const text = await xhrUpload('/api/admin/uploads/video/direct', 'POST', form, {
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
