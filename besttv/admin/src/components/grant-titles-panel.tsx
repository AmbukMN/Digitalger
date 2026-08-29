'use client';

/**
 * ⚠️⚠️ ШИРХГЭЭР КОНТЕНТ ОЛГОХ.
 *
 * Өмнө нь админ ЗӨВХӨН багц (жанраар) идэвхжүүлж чаддаг байв. Гомдол
 * шийдэхэд («буруу дансанд төлсөн», «нөхөн олговор») яг тухайн киног
 * нээх шаардлагатай ч зам байгаагүй.
 *
 * UI-ийн шийдэл:
 *   · Жанраар БҮЛЭГЛЭЖ харуулна (163 кино нэг жагсаалтад = ашиглах
 *     боломжгүй). Жанр бүр эвхэгддэг.
 *   · Хайлт — галиг дэмжсэн backend хайлтыг ашиглана.
 *   · Multi-select чагт + «энэ жанрыг бүгд» товч.
 *   · Сонгосон нь ДЭЭД талд хураангуй chip-ээр — доош гүйлгэсэн ч
 *     хэдийг сонгосон нь харагдана.
 *   · Одоо байгаа эрхийг ТЭМДЭГЛЭНЭ — давхар олгохоос сэргийлнэ.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  Clock,
  Film,
  Loader2,
  Search,
  Ticket,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@besttv/shared';
import { api } from '@/lib/api';

interface TitleRow {
  id: string;
  title: string;
  posterUrl?: string | null;
  genres?: { id: string; name: string }[];
}

interface RentalRow {
  id: string;
  titleId: string;
  title: string;
  amount: number;
  grantedByAdmin: boolean;
  expiresAt: string;
  active: boolean;
  createdAt: string;
}

/** ⚠️ Хугацааны сонголт — админ гараар тоо бодох шаардлагагүй */
const HOUR_PRESETS = [
  { h: 48, label: '2 хоног' },
  { h: 168, label: '7 хоног' },
  { h: 720, label: '30 хоног' },
  { h: 8760, label: '1 жил' },
];

export function GrantTitlesPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [hours, setHours] = useState(48);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  /* ── Одоо байгаа эрхүүд ── */
  const { data: rentals, refetch: refetchRentals } = useQuery({
    queryKey: ['admin-user-rentals', userId],
    queryFn: () => api<RentalRow[]>(`/admin/users/${userId}/rentals`),
    staleTime: 0,
  });

  /**
   * ⚠️⚠️ Эрх олгох/цуцлахад ДӨРВҮҮЛЭНГ нь шинэчилнэ:
   *   admin-user-rentals — энэ панелийн жагсаалт
   *   admin-user         — дээрх «Одоогийн эрх» карт
   *   admin-users        — ард байгаа хэрэглэгчийн ЖАГСААЛТ
   *   admin-user-counts  — дээд талын статистик картууд
   *
   * Аль нэгийг орхивол дэлгэцийн НЭГ хэсэг хуучнаараа үлдэж, админ
   * «шинэчлэгдэхгүй байна» гэж гомдоно (бодит гомдол болсон).
   */
  const refreshAll = () =>
    Promise.all([
      refetchRentals(),
      qc.invalidateQueries({ queryKey: ['admin-user', userId] }),
      qc.invalidateQueries({ queryKey: ['admin-users'] }),
      qc.invalidateQueries({ queryKey: ['admin-user-counts'] }),
    ]);

  /* ── Киноны жагсаалт ── */
  const { data: titles, isLoading } = useQuery({
    queryKey: ['admin-grant-titles', q],
    queryFn: () =>
      api<{ items: TitleRow[] }>(
        `/admin/titles?limit=300${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`,
      ).then((r) => r.items ?? []),
    staleTime: 60_000,
  });

  /** titleId → идэвхтэй эрх (давхар олгохоос сэргийлнэ) */
  const activeByTitle = useMemo(() => {
    const m = new Map<string, RentalRow>();
    for (const r of rentals ?? []) if (r.active) m.set(r.titleId, r);
    return m;
  }, [rentals]);

  /* ── Жанраар бүлэглэх ── */
  const groups = useMemo(() => {
    const g = new Map<string, { name: string; rows: TitleRow[] }>();
    for (const t of titles ?? []) {
      /* ⚠️ Жанргүй кино ч БАЙЖ БОЛНО — алгасвал админ олохгүй */
      const list = t.genres?.length ? t.genres : [{ id: '_none', name: 'Ангилаагүй' }];
      for (const gen of list) {
        const cur = g.get(gen.id) ?? { name: gen.name, rows: [] };
        cur.rows.push(t);
        g.set(gen.id, cur);
      }
    }
    return [...g.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [titles]);

  /* ⚠️ Хайлт хийсэн үед бүх жанрыг НЭЭНЭ — эс бөгөөс хайсан кино
     эвхэгдсэн бүлэг дотор нуугдана */
  useEffect(() => {
    if (!q.trim() || !groups.length) return;
    setOpen(Object.fromEntries(groups.map((g) => [g.id, true])));
  }, [q, groups]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const toggleGroup = (rows: TitleRow[]) => {
    const ids = rows.map((r) => r.id);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((cur) =>
      allOn ? cur.filter((x) => !ids.includes(x)) : [...new Set([...cur, ...ids])],
    );
  };

  const selectedTitles = useMemo(
    () => (titles ?? []).filter((t) => selected.includes(t.id)),
    [titles, selected],
  );

  const grant = async () => {
    if (!selected.length) return toast.error('Кино сонгоно уу');
    setSaving(true);
    try {
      const r = await api<{ granted: { title: string; extended: boolean }[] }>(
        `/admin/users/${userId}/grant-titles`,
        { method: 'POST', body: JSON.stringify({ titleIds: selected, hours }) },
      );
      const ext = r.granted.filter((g) => g.extended).length;
      toast.success(
        ext
          ? `${r.granted.length} кино олгов (${ext} нь сунгагдсан)`
          : `${r.granted.length} кино олгов`,
      );
      setSelected([]);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (rentalId: string, title: string) => {
    /* ⚠️ Эрх хасах нь хэрэглэгчид ШУУД нөлөөлнө — баталгаажуулна */
    if (!confirm(`«${title}» эрхийг хүчингүй болгох уу?`)) return;
    try {
      await api(`/admin/users/${userId}/rentals/${rentalId}`, { method: 'DELETE' });
      /* ⚠️⚠️ ЗӨВХӨН `refetchRentals()` байсан нь БОДИТ АЛДАА: доорх
         жагсаалт шинэчлэгддэг ч дээрх «Одоогийн эрх» карт (`admin-user`)
         хуучнаараа үлдэж, админ эрх хэвээр байна гэж бодно. */
      await refreshAll();
      toast.success('Эрх хүчингүй боллоо');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Алдаа гарлаа');
    }
  };

  const activeRentals = (rentals ?? []).filter((r) => r.active);

  return (
    <div className="space-y-4">
      {/* ── Одоо байгаа эрхүүд ── */}
      {!!activeRentals.length && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Ticket size={12} /> Идэвхтэй эрх ({activeRentals.length})
          </p>
          <div className="space-y-1.5">
            {activeRentals.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 px-2.5 py-1.5"
              >
                <Film size={13} className="shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {r.title}
                  {r.grantedByAdmin && (
                    <span className="ml-1.5 rounded bg-foreground/10 px-1 text-[10px] text-muted-foreground">
                      админ олгосон
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDateTime(r.expiresAt)}
                </span>
                <button
                  onClick={() => void revoke(r.id, r.title)}
                  title="Хүчингүй болгох"
                  className="shrink-0 text-destructive hover:opacity-70"
                >
                  <XCircle size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Сонгосон хураангуй ── */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Film size={12} /> Кино олгох
          </p>
          {!!selected.length && (
            <button
              onClick={() => setSelected([])}
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              сонголт цэвэрлэх
            </button>
          )}
        </div>

        {/*
          ⚠️ Сонгосон нь ДЭЭД талд chip-ээр — жагсаалт урт тул доош
          гүйлгэсэн ч юу сонгосноо харна.
        */}
        {!!selectedTitles.length && (
          <div className="mb-2 flex flex-wrap gap-1.5 rounded-lg border border-primary/25 bg-primary/5 p-2">
            {selectedTitles.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] text-foreground"
              >
                {t.title}
                <button onClick={() => toggle(t.id)} className="hover:opacity-70">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ── Хайлт ── */}
        <div className="relative mb-2">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Киноны нэрээр хайх (галиг дэмжинэ)…"
            className="w-full rounded-lg border border-input bg-card py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        {/* ── Жанраар бүлэглэсэн жагсаалт ── */}
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-input p-1.5">
          {isLoading ? (
            <div className="space-y-1.5 p-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-foreground/6" />
              ))}
            </div>
          ) : !groups.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Кино олдсонгүй.</p>
          ) : (
            groups.map((g) => {
              const on = open[g.id];
              const picked = g.rows.filter((r) => selected.includes(r.id)).length;
              return (
                <div key={g.id}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOpen((c) => ({ ...c, [g.id]: !c[g.id] }))}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/5"
                    >
                      <ChevronDown
                        size={13}
                        className={cn('shrink-0 transition-transform', !on && '-rotate-90')}
                      />
                      <span className="truncate">{g.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {g.rows.length}
                      </span>
                      {picked > 0 && (
                        <span className="shrink-0 rounded bg-primary/20 px-1 text-[10px] text-primary">
                          {picked}
                        </span>
                      )}
                    </button>
                    {/* ⚠️ Бүлгийг бүтнээр сонгох — 40 киног нэг нэгээр
                        дарах нь ашиглах боломжгүй */}
                    <button
                      onClick={() => toggleGroup(g.rows)}
                      className="shrink-0 rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    >
                      бүгд
                    </button>
                  </div>

                  {on && (
                    <div className="ml-4 space-y-0.5 border-l border-border pl-2">
                      {g.rows.map((t) => {
                        const isOn = selected.includes(t.id);
                        const has = activeByTitle.get(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggle(t.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors',
                              isOn ? 'bg-primary/10 text-foreground' : 'hover:bg-foreground/5',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                isOn ? 'border-primary bg-primary' : 'border-input',
                              )}
                            >
                              {isOn && <Check size={9} className="text-primary-foreground" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{t.title}</span>
                            {/* ⚠️ Аль хэдийн эрхтэйг тэмдэглэнэ — админ
                                давхар олгож хугацаа санамсаргүй сунгахаас */}
                            {has && (
                              <span className="shrink-0 text-[10px] text-success">эрхтэй</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Хугацаа + олгох ── */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} /> Хугацаа:
          </span>
          {HOUR_PRESETS.map((p) => (
            <button
              key={p.h}
              onClick={() => setHours(p.h)}
              className={cn(
                'rounded-lg border px-2 py-1 text-xs transition-colors',
                hours === p.h
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:border-primary/50',
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => void grant()}
            disabled={saving || !selected.length}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-premium px-3 py-2 text-sm font-medium text-premium-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Ticket size={15} />}
            {selected.length ? `${selected.length} кино олгох` : 'Олгох'}
          </button>
        </div>
      </div>
    </div>
  );
}
