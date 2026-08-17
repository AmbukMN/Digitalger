'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { CHANNEL_META, WEEKDAYS, type Channel, type Slot } from './types';
import { UB_LABEL, browserOffsetDiffersFromUb } from './ub-time';

/**
 * ДАРААЛЛЫН ХУВААРЬ (Buffer-ийн posting schedule).
 *
 * ⚠️⚠️ ГОЛ ОЙЛГОЛТ: эдгээр нь ДОЛОО ХОНОГ ТУТАМ давтагдах цагууд.
 * «Да 19:00» гэвэл БҮХ Даваа гарагийн 19:00. Пост нэмэхэд дараагийн
 * сул цагт автоматаар орно.
 *
 * ⚠️ Хуваарь өөрчлөгдөхөд «дараалалд» товлосон постууд ШИНЭ цаг руу
 * шилжинэ — админд ил хэлнэ, эс бөгөөс гэнэтийн зөрүү үүснэ.
 */
export function SocialSlots({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [channel, setChannel] = useState<Channel>('FACEBOOK');
  const [slots, setSlots] = useState<{ weekday: number; time: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTime, setNewTime] = useState('19:00');
  const [newDays, setNewDays] = useState<number[]>([1, 3, 5]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-social-slots'],
    queryFn: () => api<Slot[]>('/admin/social/slots'),
  });

  useEffect(() => {
    if (!data) return;
    setSlots(
      data
        .filter((s) => s.channel === channel)
        .map((s) => ({ weekday: s.weekday, time: s.time })),
    );
  }, [data, channel]);

  const addSlots = () => {
    if (!newDays.length) {
      toast.error('Гараг сонгоно уу');
      return;
    }
    setSlots((cur) => {
      const next = [...cur];
      for (const d of newDays) {
        /* ⚠️ Давхардлаас сэргийлнэ — unique constraint зөрчихөөс өмнө */
        if (!next.some((s) => s.weekday === d && s.time === newTime)) {
          next.push({ weekday: d, time: newTime });
        }
      }
      return next.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
    });
  };

  const removeSlot = (weekday: number, time: string) =>
    setSlots((cur) => cur.filter((s) => !(s.weekday === weekday && s.time === time)));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api<{ slots: number; moved: number }>('/admin/social/slots', {
        method: 'POST',
        body: JSON.stringify({ channel, slots }),
      });
      toast.success(
        r.moved > 0
          ? `Хуваарь хадгалагдлаа — ${r.moved} пост шинэ цаг руу шилжив`
          : 'Хуваарь хадгалагдлаа',
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  /* Гараг тус бүрээр бүлэглэж харуулна */
  const byDay = WEEKDAYS.map((_, d) =>
    slots.filter((s) => s.weekday === d).sort((a, b) => a.time.localeCompare(b.time)),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Нийтлэлийн хуваарь</DialogTitle>
        </DialogHeader>

        <p className="flex items-start gap-1.5 rounded-lg bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
          <Info size={13} className="mt-0.5 shrink-0" />
          Эдгээр цаг нь ДОЛОО ХОНОГ ТУТАМ давтагдана. «Дараалалд» товлосон
          пост дараагийн сул цагт автоматаар орно. Хуваарь өөрчлөхөд тэдгээр
          пост ДАГАЖ шилжинэ (тодорхой цаг сонгосон нь хөдөлдөггүй).
        </p>

        {/* Суваг сонгох */}
        <div className="mt-3 flex gap-2">
          {(['FACEBOOK', 'INSTAGRAM'] as const).map((ch) => {
            const m = CHANNEL_META[ch];
            const Icon = m.Icon;
            return (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                  channel === ch
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon size={14} /> {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="admin-skeleton h-40 rounded-lg" />
          ) : (
            <>
              {/* Цаг нэмэх */}
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Цаг нэмэх
                </p>
                {/* ⚠️⚠️ Цагийн бүсийг ИЛ — «Мя 07:00» гэдэг нь МОНГОЛЫН
                    07:00. Админ хаанаас нэвтэрсэн ч ижил үр дүн. */}
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Бүх цаг {UB_LABEL}-ийн цагаар
                  {browserOffsetDiffersFromUb() && (
                    <span className="ml-1 font-medium text-warning">
                      · таны төхөөрөмжийн цагаас өөр
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="admin-input w-28"
                  />
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((w, d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setNewDays((cur) =>
                            cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
                          )
                        }
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                          newDays.includes(d)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent text-muted-foreground hover:bg-accent/70',
                        )}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <button onClick={addSlots} className="btn-secondary">
                    <Plus size={13} /> Нэмэх
                  </button>
                </div>
              </div>

              {/* Долоо хоногийн харагдац */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {WEEKDAYS.map((w, d) => (
                  <div key={d} className="rounded-lg border border-border p-2.5">
                    <p className="mb-1.5 text-xs font-semibold text-foreground">{w}</p>
                    {byDay[d].length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {byDay[d].map((s) => (
                          <button
                            key={s.time}
                            onClick={() => removeSlot(d, s.time)}
                            title="Устгах"
                            className="flex items-center gap-1 rounded bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-destructive/15 hover:text-destructive"
                          >
                            {s.time}
                            <X size={9} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Нийт {slots.length} цаг · долоо хоногт {slots.length} пост багтана
              </p>
            </>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <button onClick={onClose} className="btn-secondary">
            Хаах
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Хадгалах
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
