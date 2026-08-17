'use client';

/**
 * ДАХИН НИЙТЛЭХ (repost) диалог.
 *
 * ⚠️⚠️ ЯАГААД ХУУЛБАР ҮҮСГЭДЭГ ВЭ: нэг пост нь НЭГ товлолтын цагтай.
 * Нэг постыг олон цагт нийтлэхийн тулд товлолт бүрд бие даасан
 * хуулбар үүсгэнэ — ингэснээр товлолт бүр өөрийн төлөв, Meta-гийн ID,
 * алдааны мессежтэй байна (Buffer/Publer-ийн загвар).
 *
 * Гурван горим:
 *   • Дараагийн сул slot × N   — хамгийн хурдан, хуваарь ашиглана
 *   • Тодорхой огноонууд        — гараар нэг бүрчлэн
 *   • Давтамжаар               — «7 хоног тутам 4 удаа» гэх мэт
 */

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2, Plus, Repeat2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@besttv/shared';
import { api } from '@/lib/api';
import type { SocialPost } from './types';

type Mode = 'SLOT' | 'DATES' | 'INTERVAL';

/** Огноог `datetime-local` input-ын хэлбэрт (орон нутгийн цагаар) */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function RepostDialog({
  post,
  onClose,
  onDone,
}: {
  post: SocialPost;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>('SLOT');
  const [count, setCount] = useState('1');
  const [dates, setDates] = useState<string[]>([
    /* ⚠️ Анхдагч нь МАРГААШ энэ цаг — өнгөрсөн огноо сонгогдохоос
       сэргийлнэ (backend татгалздаг) */
    toLocalInput(new Date(Date.now() + 24 * 3600_000)),
  ]);
  const [everyDays, setEveryDays] = useState('7');
  const [times, setTimes] = useState('4');
  const [startAt, setStartAt] = useState(toLocalInput(new Date(Date.now() + 24 * 3600_000)));
  const [busy, setBusy] = useState(false);

  /** Давтамжийн горимд гарах бодит огноонууд — админ УРЬДЧИЛАН харна */
  const intervalDates = useMemo(() => {
    const n = Math.min(20, Math.max(1, Number(times) || 1));
    const gap = Math.max(1, Number(everyDays) || 1);
    const base = new Date(startAt);
    if (Number.isNaN(base.getTime())) return [];
    return Array.from({ length: n }, (_, i) => new Date(base.getTime() + i * gap * 86400_000));
  }, [times, everyDays, startAt]);

  const addDate = () => {
    const last = dates.length ? new Date(dates[dates.length - 1]) : new Date();
    setDates([...dates, toLocalInput(new Date(last.getTime() + 7 * 86400_000))]);
  };

  const submit = async () => {
    setBusy(true);
    try {
      let body: Record<string, unknown>;
      if (mode === 'SLOT') {
        body = { count: Math.min(20, Math.max(1, Number(count) || 1)) };
      } else {
        const list = mode === 'DATES' ? dates.map((d) => new Date(d)) : intervalDates;
        const bad = list.filter((d) => Number.isNaN(d.getTime()) || d.getTime() <= Date.now());
        if (bad.length) {
          toast.error('Огноо буруу эсвэл өнгөрсөн байна');
          setBusy(false);
          return;
        }
        body = { at: list.map((d) => d.toISOString()) };
      }

      const r = await api<{
        created: { id: string; at: string | null }[];
        failed: { at: string | null; why: string }[];
      }>(`/admin/social/posts/${post.id}/repost`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      /**
       * ⚠️ ХЭСЭГЧИЛСЭН АМЖИЛТЫГ ЯЛГАЖ хэлнэ — «болсон» гэж хэлээд
       * хагас нь унасан байх нь хамгийн муу хувилбар.
       */
      if (r.created.length && r.failed.length) {
        toast.warning(`${r.created.length} товлогдлоо, ${r.failed.length} унав`, {
          description: r.failed[0]?.why,
        });
      } else if (r.created.length) {
        toast.success(`${r.created.length} удаа дахин товлолоо`);
      } else {
        toast.error(r.failed[0]?.why ?? 'Товлож чадсангүй');
        setBusy(false);
        return;
      }
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Repeat2 size={16} className="text-primary" /> Дахин нийтлэх
          </p>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          <div className="rounded-lg border border-border bg-accent/20 p-2.5">
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {post.body || '(текстгүй)'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {post.targets.map((t) => t.channel).join(' · ')}
              {post.mediaKeys.length > 0 && ` · ${post.mediaKeys.length} медиа`}
            </p>
          </div>

          {/* Горим сонгох */}
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['SLOT', 'Хуваариар'],
                ['DATES', 'Огноогоор'],
                ['INTERVAL', 'Давтамжаар'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={cn(
                  'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                  mode === k
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'SLOT' && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Хэдэн удаа давтах</label>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Тохируулсан хуваарийн дараагийн сул цагууд руу дараалан орно.
              </p>
            </div>
          )}

          {mode === 'DATES' && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Огноо тус бүрээр</label>
              {dates.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={d}
                    onChange={(e) => {
                      const next = [...dates];
                      next[i] = e.target.value;
                      setDates(next);
                    }}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  {dates.length > 1 && (
                    <button
                      onClick={() => setDates(dates.filter((_, x) => x !== i))}
                      className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {dates.length < 20 && (
                <button
                  onClick={addDate}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-accent"
                >
                  <Plus size={13} /> Огноо нэмэх
                </button>
              )}
            </div>
          )}

          {mode === 'INTERVAL' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Эхлэх</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Хэдэн хоног тутам</label>
                  <input
                    type="number"
                    min={1}
                    value={everyDays}
                    onChange={(e) => setEveryDays(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Хэдэн удаа</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={times}
                    onChange={(e) => setTimes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {/* ⚠️ УРЬДЧИЛАН ХАРУУЛНА — админ товших өмнө яг хэзээ
                  явахыг мэднэ (таамгаар товших нь алдааны эх үүсвэр) */}
              {intervalDates.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border bg-accent/20 p-2">
                  {intervalDates.map((d, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarClock size={11} /> {formatDateTime(d.toISOString())}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Болих
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Repeat2 size={13} />}
            Товлох
          </button>
        </div>
      </div>
    </div>
  );
}
