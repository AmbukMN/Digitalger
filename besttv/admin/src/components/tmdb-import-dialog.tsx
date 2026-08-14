'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Languages, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface TmdbResult {
  tmdbId: number;
  title: string;
  year: string | null;
  rating: number;
  overview: string;
  posterUrl: string | null;
  /**
   * ⚠️ ГАРАЛ ҮҮСЭЛ — админ ЯЛГАХАД чухал. Ижил нэртэй ГАДААД кино
   * байх нь энгийн: манай "Love MAP" (Монгол) ↔ америк "Love Map (2021)".
   * Улсыг харуулахгүй бол админ андуурч гадаад кино импортлоно.
   */
  originalLanguage?: string | null;
  originCountry?: string[] | null;
}

/** ISO хэл/улсын код → монгол нэр (бүгдийг биш, түгээмэлийг) */
const ORIGIN_LABEL: Record<string, string> = {
  mn: '🇲🇳 Монгол', en: '🇺🇸 Англи', ko: '🇰🇷 Солонгос', ja: '🇯🇵 Япон',
  zh: '🇨🇳 Хятад', ru: '🇷🇺 Орос', hi: '🇮🇳 Энэтхэг', tl: '🇵🇭 Филиппин',
  th: '🇹🇭 Тайланд', fr: '🇫🇷 Франц', es: '🇪🇸 Испани', de: '🇩🇪 Герман',
  tr: '🇹🇷 Турк', it: '🇮🇹 Итали', kk: '🇰🇿 Казах',
};

export interface TmdbImportResult {
  titleEn: string;
  /** ⚠️ МОНГОЛ руу орчуулсан тайлбар (AI унтраалттай бол англи хэвээр) */
  description: string;
  /** ⚠️ Англи ЭХ хувилбар — орчуулгаас үл хамааран ҮРГЭЛЖ ирнэ */
  descriptionEn?: string;
  /** SEO — монголоор (AI идэвхгүй бол хоосон) */
  metaTitle?: string;
  metaDescription?: string;
  /** AI орчуулга ҮНЭХЭЭР хийгдсэн эсэх — админд toast-оор мэдэгдэнэ */
  translated?: boolean;
  year: number | null;
  rating: number | null;
  durationSec: number | null;
  /** Найруулагч — TMDB `credits.crew` (цувралд `created_by`) */
  director?: string | null;
  /** Гарал үүслийн улс (монголоор) — хайлтад чухал */
  country?: string | null;
  actors: string[];
  genreNames: string[];
  seasonCount: number | null;
  posterKey: string | null;
  backdropKey: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  /**
   * ⚠️ Дэлгэрэнгүй cast — нэр + дүр + ЗУРАГ (R2-д mirror хийгдсэн).
   * ⚠️ `photoUrl` ЗААВАЛ хэрэгтэй: bucket private тул `photoKey`-гээр
   * шууд харуулж болохгүй, `CastEditor` нь URL уншдаг.
   */
  cast?: { name: string; character: string; photoKey: string | null; photoUrl?: string | null }[];
  /** YouTube трейлерийн key — R2 HLS трейлер (`trailerKey`)-ЭЭС ТУСДАА */
  trailerYoutubeKey?: string | null;
}

/** TMDB-ээс хайж, сонгосон контентын мэдээлэл+зургийг R2-д татаж импортлоно */
export function TmdbImportDialog({
  type,
  onImport,
  onClose,
}: {
  type: 'movie' | 'tv';
  onImport: (result: TmdbImportResult) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  /**
   * ⚠️ AI орчуулга идэвхтэй эсэхийг УРЬДЧИЛЖ мэдэж админд харуулна —
   * эс бөгөөс англи тайлбар орсныг анзаарахгүй хадгална.
   * ⚠️ Тохиргоо солигдохгүй тул 5 минут кэшлэнэ (дэмий дуудалт хэрэггүй).
   */
  const { data: status } = useQuery({
    queryKey: ['tmdb-status'],
    queryFn: () => api<{ translation: boolean }>('/admin/tmdb/status'),
    staleTime: 5 * 60_000,
  });

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await api<TmdbResult[]>(`/admin/tmdb/search?q=${encodeURIComponent(q)}&type=${type}`);
      setResults(res);
    } catch {
      toast.error('TMDB хайлт амжилтгүй — TMDB_API_KEY тохируулсан эсэхийг шалгана уу');
    } finally {
      setSearching(false);
    }
  };

  const importItem = async (tmdbId: number) => {
    setImportingId(tmdbId);
    /**
     * ⚠️ Импорт 5-15 секунд болдог (8 зураг R2 руу mirror + AI орчуулга).
     * Тэр хугацаанд юу болж байгааг ХЭЛЭХГҮЙ бол админ гацсан гэж бодоод
     * дахин дарна. Тиймээс loading toast харуулж, дуусахад солино.
     */
    const tid = toast.loading(
      status?.translation
        ? 'TMDB-ээс татаж, монгол руу орчуулж байна…'
        : 'TMDB-ээс татаж байна…',
    );
    try {
      const result = await api<TmdbImportResult>(`/admin/tmdb/import/${tmdbId}?type=${type}`);
      /* ⚠️ Дэлгэрэнгүйг дуудагч тал (onImport) toast-оор харуулна */
      toast.dismiss(tid);
      onImport(result);
      onClose();
    } catch {
      toast.error('Импорт амжилтгүй боллоо', { id: tid });
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">TMDB-ээс импорт</h2>
            {/* ⚠️ Орчуулга идэвхтэй эсэхийг ЭХЛЭЭД харуулна — импорт хийсний
                дараа англи гарч ирвэл гайхахгүй */}
            {status && (
              <p
                className={`mt-0.5 flex items-center gap-1 text-xs ${
                  status.translation ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                <Languages size={13} />
                {status.translation
                  ? 'Тайлбар, дүрийн нэр автоматаар монгол болно'
                  : 'AI орчуулга идэвхгүй — англи хэвээр орно'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={search} className="mt-4 flex gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Киноны нэр (англи)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </form>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.tmdbId}
              onClick={() => importItem(r.tmdbId)}
              disabled={importingId !== null}
              className="flex w-full items-center gap-3 rounded-md border border-border p-2.5 text-left hover:bg-muted disabled:opacity-50"
            >
              <div className="relative flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {r.posterUrl ? (
                  <Image src={r.posterUrl} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  /* ⚠️ TMDB-д постергүй кино цөөнгүй — хоосон дөрвөлжин биш
                     тодорхой дүрс харуулбал "ачаалж байна уу" гэж эргэлзэхгүй */
                  <ImageOff size={18} className="text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.title}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span>{r.year}</span>
                  {r.rating ? <span>· ★ {r.rating.toFixed(1)}</span> : null}
                  {/*
                    ⚠️ ГАРАЛ ҮҮСЛИЙГ ТОДООР — ижил нэртэй гадаад киног
                    андуурч импортлохоос сэргийлнэ (бодит алдаа гарсан:
                    Монгол "Love MAP" ↔ америк "Love Map").
                    Монгол бол НОГООН, бусад нь АНХААРУУЛГА өнгөөр.
                  */}
                  {r.originalLanguage && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        r.originalLanguage === 'mn'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-amber-500/15 text-amber-600'
                      }`}
                    >
                      {ORIGIN_LABEL[r.originalLanguage] ?? r.originalLanguage.toUpperCase()}
                    </span>
                  )}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.overview}</p>
              </div>
              {importingId === r.tmdbId && <Loader2 size={16} className="shrink-0 animate-spin text-primary" />}
            </button>
          ))}
          {!searching && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Хайлт хийж контент сонгоно уу</p>
          )}
        </div>
      </div>
    </div>
  );
}
