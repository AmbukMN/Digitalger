'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Languages, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@besttv/shared/ui';
import { api, getAccessToken } from '@/lib/api';

interface Subtitle {
  id: string;
  lang: string;
  label: string;
  isDefault: boolean;
  order: number;
}

/** Backend-ийн `SUBTITLE_LANGS`-тай ЯГ ТААРНА */
const LANGS = [
  { code: 'mn', label: 'Монгол' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ru', label: 'Русский' },
];

/**
 * ХАДМАЛ УДИРДАХ — кино эсвэл ангид.
 *
 * ⚠️ `.srt` оруулахад backend нь `.vtt` болгож хөрвүүлнэ (браузер
 * `.srt`-г уншдаггүй). Админ ямар өргөтгөлтэй файл байгааг мэдэх
 * шаардлагагүй.
 *
 * ⚠️ Фонт/хэмжээг ЭНД тохируулахгүй — тоглуулагч талд CSS-ээр
 * шийдэгдсэн. Файлд бичвэл бүх төхөөрөмжид ижил жижиг харагдана.
 */
export function SubtitleManager({
  kind,
  targetId,
}: {
  kind: 'movie' | 'episode';
  targetId: string;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState('mn');
  const [uploading, setUploading] = useState(false);

  const queryKey = ['admin-subtitles', kind, targetId];
  const { data: subs, isLoading } = useQuery({
    queryKey,
    queryFn: () => api<Subtitle[]>(`/admin/subtitles/${kind}/${targetId}`),
    enabled: Boolean(targetId),
    staleTime: 0,
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('lang', lang);
      /* ⚠️ Монгол нь анхдагчаар асна — хэрэглэгчийн гол хэл */
      fd.append('isDefault', String(lang === 'mn'));

      /**
       * ⚠️ `api()` нь JSON бичдэг тул FormData-д ТОХИРОХГҮЙ.
       * Шууд `fetch` — Content-Type-ыг браузер өөрөө тавина
       * (boundary агуулсан байх ёстой).
       */
      const res = await fetch(`/api/admin/subtitles/${kind}/${targetId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Байршуулж чадсангүй');

      toast.success(`Хадмал орлоо · ${json.cues} мөр`);
      qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (s: Subtitle) => {
    const ok = await confirm({
      title: `«${s.label}» хадмалыг устгах уу?`,
      description: 'Файл R2-оос ч устана.',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/admin/subtitles/${s.id}`, { method: 'DELETE' });
      toast.success('Устгагдлаа');
      qc.invalidateQueries({ queryKey });
    } catch {
      toast.error('Устгаж чадсангүй');
    }
  };

  /** Аль хэл аль хэдийн орсныг харуулна — давхардуулж оруулахгүй */
  const used = new Set((subs ?? []).map((s) => s.lang));

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <Languages size={15} className="text-primary" />
        <h4 className="text-sm font-bold text-foreground">Хадмал</h4>
        {subs?.length ? (
          <span className="rounded bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {subs.length} хэл
          </span>
        ) : null}
      </div>

      {/* ─── Одоо байгаа хадмалууд ─── */}
      {isLoading ? (
        <p className="py-2 text-xs text-muted-foreground">Уншиж байна…</p>
      ) : subs?.length ? (
        <div className="mb-3 space-y-1.5">
          {subs.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
            >
              <span className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">{s.label}</span>
                {s.isDefault && (
                  <span className="flex items-center gap-0.5 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                    <Star size={9} /> Анхдагч
                  </span>
                )}
              </span>
              <button
                onClick={() => remove(s)}
                aria-label="Устгах"
                className="rounded p-1 text-foreground/35 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">Хадмал ороогүй байна.</p>
      )}

      {/* ─── Шинээр оруулах ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
              {used.has(l.code) ? ' (солино)' : ''}
            </option>
          ))}
        </select>

        <input
          ref={fileRef}
          type="file"
          /* ⚠️ `.srt` ба `.vtt` хоёуланг — backend нь хөрвүүлнэ */
          accept=".srt,.vtt,text/plain,text/vtt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          .srt / .vtt оруулах
        </button>
      </div>

      {/*
        ⚠️ Админд ЯЛГААГ тайлбарлана — хадмалын харагдац нь файлаас
        БИШ, тоглуулагчаас хамаардаг гэдгийг мэдэхгүй бол `.srt`
        дотор загвар бичих гэж оролдоно.
      */}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Зөвхөн цаг + текст байхад хангалттай. Фонт, хэмжээ, өнгийг
        тоглуулагч өөрөө тохируулна — файлд бичих шаардлагагүй.
        <br />
        Монгол хадмал автоматаар асна. Хэрэглэгч цэснээс өөр хэл сонгож болно.
      </p>
    </div>
  );
}
