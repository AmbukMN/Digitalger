'use client';

/**
 * ⚠️⚠️ PAGE → PAGE / PAGE → IG ДАМЖУУЛАЛТ.
 *
 * Одоо байгаа «FB → Instagram» таб нь ЗӨВХӨН үндсэн page-ээс үндсэн
 * IG рүү явуулдаг. Хэрэглэгч 2+ page-тэй бол:
 *   · Нөгөө page-ийн постыг ОГТ харах боломжгүй
 *   · Page хооронд пост хуулах ямар ч зам байхгүй
 *
 * Энэ панел нь ДУРЫН эх → ДУРЫН зорилтот (олон сонголт).
 *
 * ⚠️ Акаунтуудыг токеноос АВТОМАТААР илрүүлнэ — админ ID бичихгүй.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Facebook,
  Images,
  Instagram,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@besttv/shared';
import { api } from '@/lib/api';

export interface SocialAccountRow {
  id: string;
  name: string;
  kind: 'FACEBOOK' | 'INSTAGRAM';
  parentPageId?: string;
  username?: string;
  pictureUrl?: string;
}

interface RelayPost {
  id: string;
  message: string;
  createdTime: string;
  permalink: string | null;
  previewUrl: string | null;
  attachments: { type: string; url: string | null }[];
  /** Аль зорилтот руу аль хэдийн явсан бэ */
  relays: { targetId: string; status: string }[];
}

interface RelayOutcome {
  postId: string;
  toId: string;
  toName: string;
  ok: boolean;
  externalId?: string;
  error?: string;
  skipped?: boolean;
}

/** Явцын нэг мөр — пост × зорилтот */
type RowState = 'WAIT' | 'RUN' | 'OK' | 'FAIL' | 'SKIP';
interface ProgressRow {
  key: string;
  label: string;
  target: string;
  state: RowState;
  error?: string;
}

export function RelayPanel() {
  const [accounts, setAccounts] = useState<SocialAccountRow[] | null>(null);
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [fromId, setFromId] = useState('');
  const [toIds, setToIds] = useState<string[]>([]);

  const [posts, setPosts] = useState<RelayPost[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const [schedule, setSchedule] = useState('');
  const [sending, setSending] = useState(false);
  /** ⚠️ Явц — «гацсан мэт» харагдахаас сэргийлнэ (хэрэглэгчийн гомдол) */
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);

  const pages = useMemo(
    () => (accounts ?? []).filter((a) => a.kind === 'FACEBOOK'),
    [accounts],
  );

  /* ── Акаунтуудыг илрүүлэх ── */
  const loadAccounts = async (refresh = false) => {
    setLoadingAcc(true);
    try {
      const rows = await api<SocialAccountRow[]>(
        `/admin/crosspost/accounts${refresh ? '?refresh=1' : ''}`,
      );
      setAccounts(rows);
      /* ⚠️ Эхний page-ийг автоматаар сонгоно — админ нэмэлт дарахгүй */
      if (!fromId && rows.length) {
        const first = rows.find((r) => r.kind === 'FACEBOOK');
        if (first) setFromId(first.id);
      }
      if (refresh) toast.success(`${rows.length} акаунт илрүүлэв`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Акаунт татаж чадсангүй');
    } finally {
      setLoadingAcc(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Эх page солигдоход постуудыг татна ── */
  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    setLoadingPosts(true);
    setPosts(null);
    setSelected([]);
    api<{ posts: RelayPost[] }>(`/admin/crosspost/accounts/${fromId}/posts?limit=25`)
      .then((r) => {
        if (!cancelled) setPosts(r.posts ?? []);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Пост татаж чадсангүй');
      })
      .finally(() => {
        if (!cancelled) setLoadingPosts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromId]);

  /* ⚠️ Эх page солигдвол өөрийг нь зорилтоос ХАСНА — эс бөгөөс
     «өөр рүүгээ дамжуулах» алдаа гарна */
  useEffect(() => {
    setToIds((cur) => cur.filter((id) => id !== fromId));
  }, [fromId]);

  const toggleTarget = (id: string) =>
    setToIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const togglePost = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const allSelected = !!posts?.length && selected.length === posts.length;

  const send = async () => {
    if (!selected.length) return toast.error('Пост сонгоно уу');
    if (!toIds.length) return toast.error('Зорилтот хуудас сонгоно уу');

    /* ⚠️ Явцын мөрүүдийг УРЬДЧИЛАН үүсгэнэ — хүсэлт эхлэх агшинд
       админ юу болохыг харна (хоосон дэлгэц харуулахгүй) */
    const rows: ProgressRow[] = [];
    for (const pid of selected) {
      const p = posts?.find((x) => x.id === pid);
      const label = (p?.message || '(текстгүй)').split('\n')[0].slice(0, 46);
      for (const tid of toIds) {
        const t = accounts?.find((a) => a.id === tid);
        rows.push({
          key: `${pid}|${tid}`,
          label,
          target: t?.name ?? tid,
          state: 'RUN',
        });
      }
    }
    setProgress(rows);
    setSending(true);

    try {
      const out = await api<RelayOutcome[]>('/admin/crosspost/relay', {
        method: 'POST',
        body: JSON.stringify({
          fromId,
          postIds: selected,
          toIds,
          ...(schedule ? { scheduledAt: new Date(schedule).toISOString() } : {}),
        }),
      });

      setProgress((cur) =>
        (cur ?? []).map((r) => {
          const o = out.find((x) => `${x.postId}|${x.toId}` === r.key);
          if (!o) return { ...r, state: 'FAIL', error: 'Хариу ирсэнгүй' };
          return {
            ...r,
            state: o.ok ? 'OK' : o.skipped ? 'SKIP' : 'FAIL',
            error: o.error,
          };
        }),
      );

      const ok = out.filter((o) => o.ok).length;
      if (ok === out.length) toast.success(`${ok} пост амжилттай дамжуулагдлаа`);
      else if (ok) toast.warning(`${ok}/${out.length} амжилттай — үлдсэнийг доор харна уу`);
      else toast.error('Дамжуулалт амжилтгүй — шалтгааныг доор харна уу');

      /* ⚠️ Амжилттай постуудыг сонголтоос хасна — дахин дарж
         ДАВХАРДУУЛАХААС сэргийлнэ */
      const doneIds = new Set(out.filter((o) => o.ok).map((o) => o.postId));
      setSelected((cur) => cur.filter((id) => !doneIds.has(id)));
    } catch (e) {
      setProgress((cur) =>
        (cur ?? []).map((r) => ({
          ...r,
          state: 'FAIL',
          error: e instanceof Error ? e.message : 'Алдаа',
        })),
      );
      toast.error(e instanceof Error ? e.message : 'Дамжуулалт амжилтгүй');
    } finally {
      setSending(false);
    }
  };

  const AccIcon = ({ kind }: { kind: 'FACEBOOK' | 'INSTAGRAM' }) =>
    kind === 'FACEBOOK' ? (
      <Facebook size={13} className="text-[#1877F2]" />
    ) : (
      <Instagram size={13} className="text-[#E4405F]" />
    );

  if (loadingAcc && !accounts) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 rounded-xl p-10 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Холбогдсон хуудсуудыг илрүүлж байна…
      </div>
    );
  }

  if (!accounts?.length) {
    return (
      <div className="admin-card rounded-xl p-8 text-center">
        <p className="text-sm text-foreground">Холбогдсон Facebook хуудас олдсонгүй.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Токен тохируулаагүй эсвэл хүчингүй байна.
        </p>
        <button
          onClick={() => void loadAccounts(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs hover:border-primary"
        >
          <RefreshCw size={13} /> Дахин шалгах
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Эх ба зорилтот сонголт ── */}
      <div className="admin-card rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Эх хуудас
            </p>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="admin-select"
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight size={18} className="mt-5 shrink-0 text-muted-foreground" />

          <div className="min-w-0 flex-[2]">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Зорилтот ({toIds.length} сонгосон)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {accounts
                .filter((a) => a.id !== fromId)
                .map((a) => {
                  const on = toIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleTarget(a.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                        on
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      <AccIcon kind={a.kind} />
                      {a.name}
                      {on && <CheckCircle2 size={12} className="text-primary" />}
                    </button>
                  );
                })}
            </div>
          </div>

          <button
            onClick={() => void loadAccounts(true)}
            title="Акаунтуудыг дахин илрүүлэх"
            className="mt-5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input hover:border-primary"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* ── Товлолт ── */}
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarClock size={13} /> Товлох (заавал биш)
            </p>
            <input
              type="datetime-local"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="admin-input w-56"
            />
          </div>
          {schedule && (
            <button
              onClick={() => setSchedule('')}
              className="mb-0.5 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Цуцлах (шууд нийтлэх)
            </button>
          )}
          {/*
            ⚠️ IG-д товлох боломж БАЙХГҮЙ (Meta-гийн хязгаар) — админд
            УРЬДЧИЛАН хэлнэ, эс бөгөөс нийтлэсний дараа алдаа хараад
            эргэлзэнэ.
          */}
          {schedule && toIds.some((id) => accounts.find((a) => a.id === id)?.kind === 'INSTAGRAM') && (
            <p className="mb-1 flex items-center gap-1.5 text-xs text-warning">
              <Clock size={12} /> Instagram товлолт дэмжигдэхгүй — тэдгээр алгасагдана
            </p>
          )}
          <div className="ml-auto">
            <button
              onClick={() => void send()}
              disabled={sending || !selected.length || !toIds.length}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {selected.length ? `${selected.length} пост дамжуулах` : 'Дамжуулах'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Явцын самбар ── */}
      {progress && (
        <div className="admin-card rounded-xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Дамжуулалтын явц ·{' '}
              {progress.filter((r) => r.state !== 'RUN' && r.state !== 'WAIT').length}/
              {progress.length}
            </p>
            {!sending && (
              <button
                onClick={() => setProgress(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Хаах
              </button>
            )}
          </div>
          {/* ⚠️ Дэвшилтийн судал — «гацсан уу» гэсэн эргэлзээг арилгана */}
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{
                width: `${Math.round(
                  (progress.filter((r) => r.state !== 'RUN' && r.state !== 'WAIT').length /
                    Math.max(1, progress.length)) * 100,
                )}%`,
              }}
            />
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {progress.map((r) => (
              <div key={r.key} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 shrink-0">
                  {r.state === 'RUN' && <Loader2 size={13} className="animate-spin text-primary" />}
                  {r.state === 'OK' && <CheckCircle2 size={13} className="text-success" />}
                  {r.state === 'FAIL' && <XCircle size={13} className="text-destructive" />}
                  {r.state === 'SKIP' && <Clock size={13} className="text-warning" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground">{r.label}</span>
                  <span className="text-muted-foreground"> → {r.target}</span>
                  {r.error && (
                    <span className="mt-0.5 block break-words text-[11px] text-destructive">
                      {r.error}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Постын жагсаалт ── */}
      <div className="admin-card rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Постууд {posts ? `(${posts.length})` : ''}
          </p>
          {!!posts?.length && (
            <button
              onClick={() => setSelected(allSelected ? [] : posts.map((p) => p.id))}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? 'Сонголтыг цуцлах' : 'Бүгдийг сонгох'}
            </button>
          )}
        </div>

        {loadingPosts ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : !posts?.length ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Пост олдсонгүй.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => {
              const on = selected.includes(p.id);
              /* ⚠️ Аль зорилтот руу аль хэдийн явсныг ХАРУУЛНА —
                 давхардуулж дарахаас сэргийлнэ */
              const sent = p.relays.filter((r) => r.status === 'PUBLISHED');
              return (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border p-2.5 transition-colors',
                    on ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/40',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => togglePost(p.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  {p.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Images size={16} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs text-foreground">
                      {p.message || '(текстгүй пост)'}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {formatDateTime(p.createdTime)}
                      {sent.map((s) => {
                        const t = accounts.find((a) => a.id === s.targetId);
                        return (
                          <span
                            key={s.targetId}
                            className="flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-success"
                          >
                            <CheckCircle2 size={10} /> {t?.name ?? 'дамжуулсан'}
                          </span>
                        );
                      })}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
