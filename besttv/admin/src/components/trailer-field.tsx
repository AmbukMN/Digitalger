'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Film, Loader2, Play, Trash2, UploadCloud, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { uploadVideo } from '@/lib/upload';
import { UploadProgress } from '@/components/upload-progress';

/**
 * ⚠️⚠️ ТРЕЙЛЕР — БАЙРШУУЛСАН (HLS) нь ҮНДСЭН, YouTube нь НӨӨЦ.
 *
 * ХЭРЭГЛЭГЧИЙН ДҮРЭМ:
 *   · Трейлерийг ЗААВАЛ upload хийж оруулна (YouTube линк БИШ).
 *   · YouTube линк байвал upload хэсгийг ХАРУУЛАХГҮЙ.
 *   · YouTube оруулаагүй бол байршуулсан трейлер идэвхтэй ажиллана.
 *   · Аль нь ч байхгүй бол frontend дээр трейлер ОГТ харагдахгүй.
 *
 * ⚠️ Backend нь аль хэдийн ЯГ ийм эрэмбэтэй: `trailerKey` (HLS) байвал
 *    `trailerYoutubeKey`-г `null` болгож илгээдэг (өөрийн CDN, зар
 *    сурталчилгаагүй). Энэ компонент нь тэр дүрмийг АДМИНД ХАРУУЛНА —
 *    өмнө нь аль трейлер тоглохыг админ таамаглах ёстой байв.
 *
 * ⚠️ Трейлерийн playlist нь НЭЭЛТТЭЙ (`OptionalJwtAuthGuard`) — нэвтрээгүй
 *    зочин ч үзнэ. Тиймээс урьдчилан үзэх линк токен шаардахгүй.
 */
export function TrailerField({
  titleId,
  trailerUrl,
  youtubeKey,
  onYoutubeChange,
  onChanged,
}: {
  /** ⚠️ Хадгалаагүй (шинэ) контентод `undefined` — upload боломжгүй */
  titleId?: string;
  /** Байршуулсан HLS трейлер байгаа эсэх (admin detail-ийн `trailerUrl`) */
  trailerUrl?: string | null;
  youtubeKey: string;
  onYoutubeChange: (v: string) => void;
  /** Upload/устгалын дараа `admin-title` query-г дахин татна */
  onChanged?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const hasUploaded = !!trailerUrl;
  const hasYoutube = !!youtubeKey.trim();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Зөвхөн видео файл сонгоно уу');
      return;
    }
    if (!titleId) {
      toast.error('Эхлээд контентоо хадгална уу, дараа нь трейлер оруулна');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const h = uploadVideo(file, { target: 'trailer', targetId: titleId }, setProgress);
      abortRef.current = h.abort;
      await h.promise;
      toast.success('Трейлер байршуулав — HLS болгож байна');
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

  return (
    <div className="mt-3 rounded-lg border border-input bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Film size={13} /> Трейлер
      </p>

      {/*
        ⚠️⚠️ YOUTUBE БАЙВАЛ UPLOAD-ЫГ ОГТ ХАРУУЛАХГҮЙ (хэрэглэгчийн дүрэм).

        Хоёуланг зэрэг харуулбал админ аль нь тоглохыг мэдэхгүй болно.
        YouTube-ээ УСТГАВАЛ upload талбар эргэж гарна.
      */}
      {hasYoutube && !hasUploaded ? (
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

          {hasUploaded && !uploading ? (
            /* ── Байршуулсан трейлер БЭЛЭН ── */
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs text-success">
                <CheckCircle2 size={13} /> Байршуулсан трейлер идэвхтэй
              </span>
              {/* ⚠️ Нээлттэй URL — токенгүй ч ажиллана (зочин үзнэ) */}
              <a
                href={`/api/stream/trailer/${titleId}/playlist.m3u8`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-foreground hover:border-primary"
              >
                <Play size={12} /> Шалгах
              </a>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-foreground hover:border-primary"
              >
                <UploadCloud size={12} /> Солих
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Устгах
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !titleId}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-primary disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Трейлер ачаалж байна... {progress}%
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  {titleId
                    ? 'Трейлер видео сонгох (заавал биш)'
                    : 'Эхлээд хадгална уу — дараа нь трейлер орно'}
                </>
              )}
            </button>
          )}

          {uploading && (
            <UploadProgress
              className="mt-2"
              percent={progress}
              phase={progress >= 100 ? 'processing' : 'uploading'}
              label={progress >= 100 ? 'HLS болгож байна...' : 'Трейлер байршуулж байна...'}
              onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
            />
          )}
        </>
      )}

      {/*
        ⚠️ YOUTUBE — НӨӨЦ хувилбар. Байршуулсан трейлер БАЙВАЛ энэ нь
        хэрэглэгчид ХҮРЭХГҮЙ (backend `null` болгож илгээнэ) тул админд
        ТОДОРХОЙ хэлнэ — эс бөгөөс «яагаад миний YouTube трейлер гарахгүй
        байна вэ?» гэсэн эргэлзээ үүснэ.
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
        {!hasYoutube && !hasUploaded && (
          <p className="mt-1 text-xs text-muted-foreground">
            Трейлер оруулаагүй — хэрэглэгчид «Трейлер» товч ОГТ харагдахгүй.
          </p>
        )}
      </div>
    </div>
  );
}
