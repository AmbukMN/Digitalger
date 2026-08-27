'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Film, Loader2, Trash2, UploadCloud, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { uploadVideo } from '@/lib/upload';
import { UploadProgress } from '@/components/upload-progress';
import { VideoPreview } from '@/components/video-preview';

/**
 * ⚠️⚠️ ТРЕЙЛЕР — БАЙРШУУЛСАН (HLS) нь ҮНДСЭН, YouTube нь НӨӨЦ.
 *
 * ХЭРЭГЛЭГЧИЙН ДҮРЭМ:
 *   · Трейлерийг ЗААВАЛ upload хийж оруулна (YouTube линк БИШ).
 *   · YouTube линк байвал upload хэсгийг ХАРУУЛАХГҮЙ.
 *   · YouTube оруулаагүй бол байршуулсан трейлер идэвхтэй ажиллана.
 *   · Аль нь ч байхгүй бол frontend дээр трейлер ОГТ харагдахгүй.
 *   · ⚠️ Харагдац нь КИНО оруулахтай ЯГ ИЖИЛ байх ёстой.
 *
 * ⚠️ Backend нь аль хэдийн ЯГ ийм эрэмбэтэй: `trailerKey` (HLS) байвал
 *    `trailerYoutubeKey`-г `null` болгож илгээдэг (өөрийн CDN, зар
 *    сурталчилгаагүй).
 *
 * ⚠️ Трейлерийн playlist НЭЭЛТТЭЙ (`OptionalJwtAuthGuard`) — нэвтрээгүй
 *    зочин ч үзнэ.
 */

/** Явцаас фазыг таамаглаж ойлгомжтой текст болгоно (`video-upload`-тай ИЖИЛ) */
function phaseLabel(pct: number): string {
  if (pct < 15) return 'Файл татаж байна';
  if (pct < 70) return 'Хөрвүүлж байна';
  return 'Cloudflare руу илгээж байна';
}

export function TrailerField({
  titleId,
  trailerUrl,
  trailerStatus,
  trailerProgress,
  trailerError,
  trailerFileName,
  youtubeKey,
  onYoutubeChange,
  onChanged,
}: {
  /** ⚠️ Хадгалаагүй (шинэ) контентод `undefined` — upload боломжгүй */
  titleId?: string;
  /** Байршуулсан HLS трейлер байгаа эсэх (admin detail-ийн `trailerUrl`) */
  trailerUrl?: string | null;
  /** NONE | PROCESSING | READY | FAILED — кино/ангитай ИЖИЛ */
  trailerStatus?: string;
  /** Серверийн HLS хөрвүүлэлтийн явц 0-100 */
  trailerProgress?: number;
  /** Амжилтгүй болсон шалтгаан */
  trailerError?: string | null;
  /** Байршуулсан эх файлын нэр */
  trailerFileName?: string | null;
  youtubeKey: string;
  onYoutubeChange: (v: string) => void;
  /** Upload/устгалын дараа `admin-title` query-г дахин татна */
  onChanged?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  /** ⚠️ Сонгосон файлын нэр — upload явж байхад ЯМАР файл орж байгааг харуулна */
  const [pickedName, setPickedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const hasUploaded = !!trailerUrl;
  const hasYoutube = !!youtubeKey.trim();
  const processing = trailerStatus === 'PROCESSING';
  const failed = trailerStatus === 'FAILED';
  const pct = trailerProgress ?? 0;

  /**
   * ⚠️⚠️ ХӨРВҮҮЛЭЛТ ЯВЖ БАЙХАД 5 СЕК ТУТАМ ШИНЭЧИЛНЭ.
   *
   * `video-upload.tsx`-тэй ЯГ ИЖИЛ зан төлөв. Үүнгүй үед админ
   * хуудсаа ГАРААР сэргээж байж л явцыг мэднэ — өмнө нь трейлер
   * байршуулаад «болсон уу, үгүй юу» гэдгийг ойлгох ямар ч зам
   * байгаагүй (хэрэглэгчийн гомдол).
   */
  useEffect(() => {
    if (!processing || !onChanged) return;
    const t = setInterval(() => onChanged(), 5000);
    return () => clearInterval(t);
  }, [processing, onChanged]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Зөвхөн видео файл сонгоно уу');
      return;
    }
    if (!titleId) {
      toast.error('Эхлээд контентоо хадгална уу, дараа нь трейлер оруулна');
      return;
    }
    setPickedName(file.name);
    setUploading(true);
    setProgress(0);
    try {
      const h = uploadVideo(file, { target: 'trailer', targetId: titleId }, setProgress);
      abortRef.current = h.abort;
      await h.promise;
      toast.success('Трейлер ачаалагдлаа — HLS хөрвүүлэлт эхэллээ');
      onChanged?.();
    } catch {
      /* ⚠️ Алдаа/цуцлалтын toast-ыг `uploadVideo` дотор харуулсан */
    } finally {
      abortRef.current = null;
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = async () => {
    if (!titleId) return;
    /* ⚠️ Устгал нь R2-оос БУЦААХГҮЙ — заавал баталгаажуулна */
    if (!confirm('Байршуулсан трейлерийг устгах уу? Буцаах боломжгүй.')) return;
    setRemoving(true);
    try {
      const r = await api<{ ok: boolean; youtubeFallback: string | null }>(
        `/admin/titles/${titleId}/trailer`,
        { method: 'DELETE' },
      );
      toast.success(
        r.youtubeFallback ? 'Трейлер устлаа — YouTube хувилбар идэвхжлээ' : 'Трейлер устлаа',
      );
      onChanged?.();
    } catch {
      /* toast-ыг `api` дотор харуулсан */
    } finally {
      setRemoving(false);
    }
  };

  /** ⚠️ Харуулах файлын нэр — сонгосон нь давуу (upload явж байхад) */
  const shownName = pickedName ?? trailerFileName ?? null;

  return (
    <div className="mt-3 rounded-lg border border-input bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Film size={13} /> Трейлер
      </p>

      {/*
        ⚠️⚠️ YOUTUBE БАЙВАЛ UPLOAD-ЫГ ОГТ ХАРУУЛАХГҮЙ (хэрэглэгчийн дүрэм).
        Хоёуланг зэрэг харуулбал админ аль нь тоглохыг мэдэхгүй болно.
      */}
      {hasYoutube && !hasUploaded && !processing ? (
        <p className="mb-2 rounded-md bg-warning/10 px-2.5 py-2 text-xs text-warning">
          YouTube трейлер орсон тул байршуулах боломжгүй. Өөрийн видео оруулахыг хүсвэл доорх
          YouTube талбарыг ХООСЛОНО уу.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />

          {/*
            ⚠️ ҮНДСЭН ТОВЧ — `video-upload.tsx`-тэй ЯГ ИЖИЛ загвар
            (тасархай хүрээ, доод талд явцын судал).
          */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !titleId}
            className="relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-dashed border-input bg-muted/30 py-6 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Ачаалж байна... {progress}%
                <div className="absolute inset-x-0 bottom-0 h-1 bg-border">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                {!titleId
                  ? 'Эхлээд хадгална уу — дараа нь трейлер орно'
                  : hasUploaded
                    ? 'Трейлер солих'
                    : 'Трейлер upload хийх (заавал биш)'}
              </>
            )}
          </button>

          {/*
            ⚠️⚠️ СОНГОСОН ФАЙЛЫН НЭР — хэрэглэгчийн шаардлага:
            «файл орсон бол орсон нь мэдэгдэж нэр харагдах ёстой».
            Өмнө нь ямар файл орсныг мэдэх ямар ч зам байгаагүй.
          */}
          {shownName && (
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <Film size={11} className="shrink-0" />
              <span className="truncate" title={shownName}>
                {shownName}
              </span>
            </p>
          )}

          {/* Байршуулалтын явц — цуцлах товчтой */}
          {uploading && (
            <UploadProgress
              className="mt-2"
              percent={progress}
              phase={progress >= 100 ? 'processing' : 'uploading'}
              label={progress >= 100 ? 'HLS болгож байна...' : 'Трейлер байршуулж байна...'}
              onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
            />
          )}

          {/*
            ⚠️⚠️ СЕРВЕРИЙН ХӨРВҮҮЛЭЛТИЙН ЯВЦ — `video-upload.tsx`-тэй ИЖИЛ.

            Хэрэглэгчийн шаардлага: «цонх хаасан ч progress bar болон бусад
            мэдээлэл харагддаг байх хэрэгтэй». Хөрвүүлэлт нь СЕРВЕР дээр
            явдаг тул хуудас хаагдсан ч үргэлжилнэ — дахин нээхэд энэ хэсэг
            явцыг харуулна.
          */}
          {processing && !uploading && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-warning">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {pct > 0 ? phaseLabel(pct) : 'Хөрвүүлэлт эхэлж байна'}
                </span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-warning/15">
                <div
                  className="h-full rounded-full bg-warning transition-all duration-500"
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Хуудсаа хаасан ч үргэлжилнэ · автомат шинэчлэгдэнэ
              </p>
            </div>
          )}

          {failed && !uploading && (
            <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2">
              <p className="text-xs font-medium text-destructive">Хөрвүүлэлт амжилтгүй боллоо</p>
              {trailerError && (
                <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                  {trailerError}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">Дахин upload хийнэ үү</p>
            </div>
          )}

          {/* ── Байршуулсан трейлер БЭЛЭН ── */}
          {hasUploaded && !uploading && !processing && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 size={13} /> Трейлер бэлэн, тоглуулах боломжтой
                </span>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="ml-auto flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Устгах
                </button>
              </div>
              {/* ⚠️ Байршуулсан видеогоо ШАЛГАХ — буруу файл орсныг эндээс мэднэ
                  (кино/ангитай ЯГ ИЖИЛ компонент) */}
              {titleId && <VideoPreview kind="trailer" id={titleId} />}
            </>
          )}
        </>
      )}

      {/*
        ⚠️ YOUTUBE — НӨӨЦ хувилбар. Байршуулсан трейлер БАЙВАЛ энэ нь
        хэрэглэгчид ХҮРЭХГҮЙ (backend `null` болгож илгээнэ) тул админд
        ТОДОРХОЙ хэлнэ.
      */}
      <div className="mt-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Youtube size={13} /> YouTube трейлер {hasUploaded && '(идэвхгүй)'}
        </label>
        <input
          value={youtubeKey}
          onChange={(e) => {
            /* ⚠️ Бүтэн линк буулгасан ч key-г нь салгаж авна */
            const v = e.target.value.trim();
            const m = v.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
            onYoutubeChange(m?.[1] ?? v);
          }}
          placeholder="dQw4w9WgXcQ эсвэл бүтэн линк"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {hasYoutube && hasUploaded && (
          <p className="mt-1 text-xs text-muted-foreground">
            Байршуулсан трейлер давуу — энэ линк хэрэглэгчид харагдахгүй.
          </p>
        )}
        {hasYoutube && !hasUploaded && (
          <a
            href={`https://youtu.be/${youtubeKey}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            youtu.be/{youtubeKey} — шалгах
          </a>
        )}
        {!hasYoutube && !hasUploaded && !processing && (
          <p className="mt-1 text-xs text-muted-foreground">
            Трейлер оруулаагүй — хэрэглэгчид «Трейлер» товч ОГТ харагдахгүй.
          </p>
        )}
      </div>
    </div>
  );
}
