'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Minus, Plus, Replace, Tags } from 'lucide-react';
import { cn } from '@besttv/shared';
import { useAdminGenres } from '@/lib/queries';
import { genreStyle } from '@/lib/genre';

export type BulkGenreMode = 'add' | 'remove' | 'replace';

/** Сонгосон кино тус бүрийн ОДООГИЙН жанр — нөлөөллийг урьдчилан харуулахад */
export interface SelectedTitleGenres {
  id: string;
  title: string;
  genreIds: string[];
}

const MODES: {
  key: BulkGenreMode;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'add',
    label: 'Нэмэх',
    hint: 'Одоо байгаа жанр дээр нь нэмнэ — юу ч устахгүй',
    icon: <Plus size={13} />,
  },
  {
    key: 'remove',
    label: 'Хасах',
    hint: 'Зөвхөн сонгосон жанраас хасна — бусад жанр хэвээр',
    icon: <Minus size={13} />,
  },
  {
    key: 'replace',
    label: 'Бүгдийг солих',
    hint: 'Хуучин БҮХ жанрыг устгаад сонгосноор солино',
    icon: <Replace size={13} />,
  },
];

/**
 * ЖАНР бөөнөөр солих цэс.
 *
 * ⚠️⚠️ ЯАГААД ГУРВАН ГОРИМ ВЭ: кино нь ОЛОН жанрт зэрэг харьяалагдана
 * («Монгол кино» + «Насанд хүрэгчдийн» гэх мэт). Ганц «солих» үйлдэлтэй
 * байсан бол админ «С-drama доторх AI кинонуудыг AI багц руу» зөөх үед
 * тэдгээрийн бусад жанр ЧИМЭЭГҮЙ устана — буцаах ч аргагүй.
 *
 * Тиймээс `add` нь АНХДАГЧ, `replace` нь улаан анхааруулгатай.
 *
 * ⚠️ Нөлөөллийг ГҮЙЦЭТГЭХЭЭС ӨМНӨ харуулна: «N кино хэдэн жанраа
 * алдана» — эс бөгөөс админ дарсны дараа л мэднэ.
 */
export function BulkGenreMenu({
  selected,
  disabled,
  onApply,
}: {
  /** Сонгогдсон кинонуудын одоогийн жанр — нөлөөллийн тайланд */
  selected: SelectedTitleGenres[];
  disabled?: boolean;
  onApply: (genreIds: string[], mode: BulkGenreMode) => Promise<void>;
}) {
  const { data: genres } = useAdminGenres();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BulkGenreMode>('add');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* ⚠️ Гадуур дарах + Esc — админ панелийн заавал дүрэм */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* ⚠️ Цэс хаагдахад сонголтыг цэвэрлэнэ — дараагийн удаа хуучин
     сонголт үлдвэл админ санамсаргүй буруу жанр оноож болзошгүй. */
  useEffect(() => {
    if (!open) {
      setPicked(new Set());
      setMode('add');
    }
  }, [open]);

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ids = useMemo(() => [...picked], [picked]);

  /**
   * НӨЛӨӨЛЛИЙН УРЬДЧИЛСАН ТООЦОО — дарахаас ӨМНӨ.
   *
   * ⚠️ `replace` үед хэдэн кино ХЭДЭН жанраа алдахыг тоолно. Энэ тоо
   * л админыг «бүгдийг солих»-ыг санамсаргүй дарахаас хамгаална.
   */
  const impact = useMemo(() => {
    if (!ids.length && mode !== 'replace') return null;
    const pickedSet = new Set(ids);

    if (mode === 'replace') {
      const losing = selected.filter((t) =>
        t.genreIds.some((g) => !pickedSet.has(g)),
      );
      return {
        kind: 'replace' as const,
        losing: losing.length,
        names: losing.slice(0, 4).map((t) => t.title),
      };
    }
    if (mode === 'add') {
      /* Аль хэдийн тухайн жанртай кино — өөрчлөгдөхгүй */
      const changed = selected.filter((t) => ids.some((g) => !t.genreIds.includes(g)));
      return { kind: 'add' as const, changed: changed.length, noop: selected.length - changed.length };
    }
    const changed = selected.filter((t) => ids.some((g) => t.genreIds.includes(g)));
    /* ⚠️ Жанргүй үлдэх кино — каталогт хаана ч харагдахгүй болно */
    const emptied = selected.filter(
      (t) => t.genreIds.length > 0 && t.genreIds.every((g) => pickedSet.has(g)),
    );
    return { kind: 'remove' as const, changed: changed.length, emptied: emptied.length };
  }, [ids, mode, selected]);

  /* `replace` нь хоосон сонголттой ч ажиллана (бүх жанрыг арилгах) */
  const canApply = mode === 'replace' ? true : ids.length > 0;

  const apply = async () => {
    setBusy(true);
    try {
      await onApply(ids, mode);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={disabled}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
          open
            ? 'border-primary/50 bg-primary/10 text-foreground'
            : 'border-border bg-card text-muted-foreground hover:text-foreground',
        )}
      >
        <Tags size={14} />
        Жанр солих
      </button>

      {open && (
        <div className="admin-dropdown absolute right-0 z-40 mt-1.5 w-80 rounded-xl border border-border bg-card p-3 shadow-xl">
          {/* ── Горим ── */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-foreground/5 p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  'flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors',
                  mode === m.key
                    ? m.key === 'replace'
                      ? 'bg-destructive text-white'
                      : 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-0.5 text-[11px] leading-snug text-muted-foreground">
            {MODES.find((m) => m.key === mode)!.hint}
          </p>

          {/* ── Жанрын сонголт ── */}
          <div className="mt-2.5 max-h-56 space-y-1 overflow-y-auto">
            {!genres?.length && (
              <p className="py-4 text-center text-xs text-muted-foreground">Жанр алга</p>
            )}
            {genres?.map((g) => {
              const on = picked.has(g.id);
              /* Сонгосон кинооос хэд нь энэ жанртай вэ — шийдэхэд тусална */
              const have = selected.filter((t) => t.genreIds.includes(g.id)).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggle(g.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    on
                      ? 'border-primary/50 bg-primary/8'
                      : 'border-transparent hover:bg-foreground/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      'truncate rounded px-1.5 py-0.5 text-[11px] font-semibold',
                      genreStyle(g.name),
                    )}
                  >
                    {g.name}
                  </span>
                  {/* ⚠️ 18+ жанрыг ТОДРУУЛНА — санамсаргүй оноохоос сэргийлнэ */}
                  {g.isAdult && (
                    <span className="shrink-0 rounded bg-destructive/15 px-1 text-[10px] font-bold text-destructive">
                      18+
                    </span>
                  )}
                  {have > 0 && (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {have}/{selected.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Нөлөөлөл (дарахаас ӨМНӨ) ── */}
          {impact && (
            <div
              className={cn(
                'mt-2.5 rounded-lg border p-2.5 text-[11px] leading-snug',
                (impact.kind === 'replace' && impact.losing > 0) ||
                  (impact.kind === 'remove' && impact.emptied > 0)
                  ? 'border-destructive/30 bg-destructive/8 text-destructive'
                  : 'border-border bg-foreground/4 text-muted-foreground',
              )}
            >
              {impact.kind === 'replace' &&
                (impact.losing > 0 ? (
                  <>
                    <p className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle size={12} />
                      {impact.losing} кино хуучин жанраа алдана
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {impact.names.join(', ')}
                      {impact.losing > impact.names.length && ` +${impact.losing - impact.names.length}`}
                    </p>
                  </>
                ) : (
                  <p>Алдагдах жанр алга — бүгд сонгосон жанрт аль хэдийн байна.</p>
                ))}

              {impact.kind === 'add' && (
                <p>
                  {impact.changed} кинонд нэмэгдэнэ
                  {impact.noop > 0 && ` · ${impact.noop} нь аль хэдийн энэ жанрт байна`}
                </p>
              )}

              {impact.kind === 'remove' && (
                <>
                  <p className={impact.emptied > 0 ? 'font-semibold' : ''}>
                    {impact.changed} кинооос хасагдана
                  </p>
                  {/* ⚠️ Жанргүй кино каталогийн ЯМАР Ч эгнээнд харагдахгүй */}
                  {impact.emptied > 0 && (
                    <p className="mt-1 flex items-center gap-1.5">
                      <AlertTriangle size={12} />
                      {impact.emptied} кино ЖАНРГҮЙ үлдэж каталогт харагдахаа болино
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Болих
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy || !canApply}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40',
                mode === 'replace' ? 'bg-destructive' : 'bg-primary',
              )}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {selected.length} кинод хэрэглэх
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
