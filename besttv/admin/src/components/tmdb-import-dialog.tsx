'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface TmdbResult {
  tmdbId: number;
  title: string;
  year: string | null;
  rating: number;
  overview: string;
  posterUrl: string | null;
}

export interface TmdbImportResult {
  titleEn: string;
  description: string;
  year: number | null;
  rating: number | null;
  durationSec: number | null;
  actors: string[];
  genreNames: string[];
  seasonCount: number | null;
  posterKey: string | null;
  backdropKey: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
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
    try {
      const result = await api<TmdbImportResult>(`/admin/tmdb/import/${tmdbId}?type=${type}`);
      onImport(result);
      toast.success('TMDB мэдээлэл импортлогдлоо');
      onClose();
    } catch {
      toast.error('Импорт амжилтгүй боллоо');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">TMDB-ээс импорт</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
                {r.posterUrl && <Image src={r.posterUrl} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.year} {r.rating ? `· ★ ${r.rating.toFixed(1)}` : ''}
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
