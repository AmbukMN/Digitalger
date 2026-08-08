'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { api, getAccessToken } from '@/lib/api';
import { VideoPreview } from '@/components/video-preview';

type Target = 'movie' | 'episode' | 'trailer';

/**
 * Видео upload — 2 горим:
 *  - R2: browser ШУУД R2 руу (presigned PUT), backend дамжихгүй
 *  - Local disk: browser → backend (/video/direct, XHR progress-той), учир нь
 *    presigned PUT боломжгүй (R2 байхгүй үед)
 * Хоёулаа дараа нь /video/complete дуудаад HLS queue-д нэмнэ.
 */
/** Явцаас фазыг таамаглаж ойлгомжтой текст болгоно */
function phaseLabel(pct: number): string {
  if (pct < 15) return 'Файл татаж байна';
  if (pct < 70) return 'Хөрвүүлж байна';
  return 'Cloudflare руу илгээж байна';
}

export function VideoUpload({
  target,
  targetId,
  currentStatus,
  streamProgress,
  streamError,
  onDone,
}: {
  target: Target;
  targetId: string;
  currentStatus?: string;
  /** Сервер талын HLS хөрвүүлэлтийн явц 0-100 */
  streamProgress?: number;
  /** Амжилтгүй болсон шалтгаан */
  streamError?: string | null;
  onDone?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressPct = streamProgress ?? 0;

  /**
   * ⚠️ PROCESSING үед 5 сек тутам шинэчилнэ — хэрэглэгч хуудсаа гараар
   * сэргээх шаардлагагүй. Бэлэн болмогц автоматаар зогсоно.
   */
  useEffect(() => {
    if (currentStatus !== 'PROCESSING' || !onDone) return;
    const t = setInterval(() => onDone(), 5000);
    return () => clearInterval(t);
  }, [currentStatus, onDone]);

  /**
   * @param auth  Backend руу явж байгаа эсэх.
   *   ⚠️⚠️ R2 presigned PUT-д ЗААВАЛ false. Яагаад:
   *     - `Authorization` бол "simple header" БИШ → browser preflight шаардана
   *     - Preflight-д `Access-Control-Request-Headers: authorization` очно
   *     - Presigned URL-ийн гарын үсэг `Authorization`-ийг тооцоогүй тул R2
   *       preflight-ыг ТАТГАЛЗАНА → browser PUT-ыг илгээхгүй → net::ERR_FAILED
   *   Өмнө нь энд болзолгүй `Authorization` тавьдаг байсан тул анги/кино/
   *   трейлерийн видео upload БҮГД унадаг байсан.
   */
  const xhrUpload = (
    url: string,
    method: string,
    body: File | FormData,
    contentType?: string,
    auth = true,
  ) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status < 300) resolve(xhr.responseText);
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Сүлжээний алдаа — upload амжилтгүй'));
      xhr.open(method, url);
      if (auth) {
        const token = getAccessToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      if (contentType) xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(body);
    });

  const upload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const { mode } = await api<{ mode: 'local' | 'r2' }>('/admin/uploads/video/init', {
        method: 'POST',
      });

      let rawKey: string;
      if (mode === 'r2') {
        const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
          '/admin/uploads/video/presign',
          { method: 'POST', body: JSON.stringify({ fileName: file.name }) },
        );
        // ⚠️ auth=false — presigned URL-д Authorization тавьбал preflight унана
        await xhrUpload(uploadUrl, 'PUT', file, file.type || 'video/mp4', false);
        rawKey = key;
      } else {
        // ⚠️ Next.js rewrite (/api/*) том файл upload-д тохирохгүй (dev/production
        // сервер дундуур stream дамжуулалт найдваргүй, "100%" дээр гацдаг) —
        // backend руу ШУУД absolute URL-аар (Next rewrite тойрч) явуулна.
        // ⚠️ SAME-ORIGIN ЗААВАЛ — cross-origin preflight дээр Authorization
        //    алдагдаж 401 буцдаг (зураг upload-тай яг ижил шалтгаан).
        const form = new FormData();
        form.append('file', file);
        const resText = await xhrUpload('/api/admin/uploads/video/direct', 'POST', form);
        rawKey = (JSON.parse(resText) as { key: string }).key;
      }

      await api('/admin/uploads/video/complete', {
        method: 'POST',
        body: JSON.stringify({ target, targetId, rawKey }),
      });

      toast.success('Видео ачаалагдлаа — HLS хөрвүүлэлт эхэллээ');
      onDone?.();
    } catch {
      toast.error('Видео upload амжилтгүй боллоо');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-dashed border-input bg-muted/30 py-6 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Ачаалж байна... {progress}%
            <div className="absolute inset-x-0 bottom-0 h-1 bg-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <UploadCloud size={16} />
            {currentStatus === 'READY' ? 'Видео солих' : 'Видео upload хийх'}
          </>
        )}
      </button>
      {/*
        ⚠️ БОДИТ явц — өмнө нь зөвхөн "1-3 минут" гэсэн тогтмол текст байсан
        тул гацсан ч ялгагдахгүй, хэрэглэгч мөнхөд хүлээдэг байсан.
        Одоо: хувь + фаз + 5 сек тутам автомат шинэчлэл.
      */}
      {currentStatus === 'PROCESSING' && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-warning">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              {progressPct > 0 ? phaseLabel(progressPct) : 'Хөрвүүлэлт эхэлж байна'}
            </span>
            <span className="font-semibold">{progressPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-warning/15">
            <div
              className="h-full rounded-full bg-warning transition-all duration-500"
              style={{ width: `${Math.max(progressPct, 3)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Хуудсаа хаасан ч үргэлжилнэ · автомат шинэчлэгдэнэ
          </p>
        </div>
      )}
      {currentStatus === 'FAILED' && (
        <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2">
          <p className="text-xs font-medium text-destructive">Хөрвүүлэлт амжилтгүй боллоо</p>
          {streamError && (
            <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{streamError}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">Дахин upload хийнэ үү</p>
        </div>
      )}
      {currentStatus === 'READY' && !uploading && (
        <>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-success">Видео бэлэн, тоглуулах боломжтой</p>
          {/* ⚠️ Байршуулсан видеогоо ШАЛГАХ — буруу файл орсныг эндээс мэднэ */}
          <VideoPreview kind={target} id={targetId} />
        </>
      )}
    </div>
  );
}
