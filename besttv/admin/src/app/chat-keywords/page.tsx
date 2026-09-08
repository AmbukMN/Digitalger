'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  FlaskConical,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { Pagination } from '@/components/pagination';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminChatKeywords, type AdminChatKeyword } from '@/lib/queries';

/**
 * ⚠️⚠️ ЧАТБОТЫН ТҮЛХҮҮР ҮГ — админаас удирдана.
 *
 * БОДИТ ХЭРЭГЦЭЭ: хэрэглэгч чатад «99», «999» гэж бичихэд
 * «Өнчин охин» киног харуулах. Тэр үг гарчигт БАЙХГҮЙ тул
 * энгийн хайлт ОЛОХГҮЙ.
 *
 * ⚠️ Админ хэдэн ч дүрэм нэмнэ — код засах шаардлагагүй.
 * ⚠️ Дүрэм нь ГУРВАН СУВАГТ (вэб/FB/IG) ижил ажиллана.
 */

type MatchType = AdminChatKeyword['matchType'];

interface Form {
  keywords: string;
  matchType: MatchType;
  titleIds: string[];
  reply: string;
  note: string;
  isActive: boolean;
  order: number;
}

const EMPTY: Form = {
  keywords: '',
  matchType: 'EXACT',
  titleIds: [],
  reply: '',
  note: '',
  isActive: true,
  order: 0,
};

const MATCH_LABEL: Record<MatchType, { label: string; hint: string }> = {
  EXACT: {
    label: 'Яг таарах',
    hint: 'Мессеж ЯГ энэ үгтэй тэнцүү («99»). Хамгийн нарийн — санамсаргүй таарц гарахгүй.',
  },
  CONTAINS: {
    label: 'Дотор нь',
    hint: 'Мессежийн дотор бүтэн үгээр байвал («99 кино байна уу»). ⚠️ Богино үгэнд болгоомжтой.',
  },
  PREFIX: {
    label: 'Эхэлбэл',
    hint: 'Мессежийн эхэнд байвал.',
  },
};

export default function ChatKeywordsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AdminChatKeyword | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  /* ⚠️ Хайлтыг debounce — үсэг бүрд сервер рүү очихгүй */
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const LIMIT = 20;
  const { data, isLoading, isError, refetch } = useAdminChatKeywords({
    q: debouncedQ || undefined,
    page,
    limit: LIMIT,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  /* ─── Кино хайх (форм дотор) ─────────────────────────────── */
  const [titleQ, setTitleQ] = useState('');
  const [titleHits, setTitleHits] = useState<
    { id: string; title: string; slug: string }[]
  >([]);
  const [titleBusy, setTitleBusy] = useState(false);

  useEffect(() => {
    const s = titleQ.trim();
    if (s.length < 2) {
      setTitleHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setTitleBusy(true);
      try {
        const r = await api<{ items: { id: string; title: string; slug: string }[] }>(
          `/admin/titles?q=${encodeURIComponent(s)}&limit=8`,
        );
        setTitleHits(r.items ?? []);
      } catch {
        setTitleHits([]);
      } finally {
        setTitleBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [titleQ]);

  /**
   * ⚠️ Сонгосон киноны НЭРИЙГ хадгална — засварлаж байхад
   * серверээс дахин татахгүй (форм хаагдтал нэр алга болно).
   */
  const [picked, setPicked] = useState<{ id: string; title: string }[]>([]);

  const openNew = () => {
    setForm(EMPTY);
    setPicked([]);
    setTitleQ('');
    setEditing('new');
  };

  const openEdit = (k: AdminChatKeyword) => {
    setForm({
      keywords: k.keywords.join(', '),
      matchType: k.matchType,
      titleIds: k.titleIds,
      reply: k.reply ?? '',
      note: k.note ?? '',
      isActive: k.isActive,
      order: k.order,
    });
    setPicked(k.titles.map((t) => ({ id: t.id, title: t.title })));
    setTitleQ('');
    setEditing(k);
  };

  const save = async () => {
    /* ⚠️ Таслалаар салгасан үгсийг массив болгоно */
    const keywords = form.keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!keywords.length) {
      toast.error('Дор хаяж нэг түлхүүр үг оруулна уу');
      return;
    }
    /* ⚠️ Кино ч, текст ч байхгүй бол дүрэм УТГАГҮЙ */
    if (!form.titleIds.length && !form.reply.trim()) {
      toast.error('Кино сонгох эсвэл текст хариу бичнэ үү');
      return;
    }

    setSaving(true);
    const body = {
      keywords,
      matchType: form.matchType,
      titleIds: form.titleIds,
      reply: form.reply.trim(),
      note: form.note.trim(),
      isActive: form.isActive,
      order: form.order,
    };
    const ok = await runMutation(
      () =>
        editing === 'new'
          ? api('/admin/chat-keywords', { method: 'POST', body: JSON.stringify(body) })
          : api(`/admin/chat-keywords/${(editing as AdminChatKeyword).id}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            }),
      { success: editing === 'new' ? 'Дүрэм нэмэгдлээ' : 'Хадгаллаа' },
    );
    setSaving(false);
    if (ok) {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['admin-chat-keywords'] });
    }
  };

  const remove = async (k: AdminChatKeyword) => {
    const yes = await confirm({
      title: 'Дүрэм устгах',
      description: `«${k.keywords.join(', ')}» дүрмийг устгах уу?`,
      confirmLabel: 'Устгах',
      tone: 'danger',
    });
    if (!yes) return;
    const ok = await runMutation(
      () => api(`/admin/chat-keywords/${k.id}`, { method: 'DELETE' }),
      { success: 'Устгалаа' },
    );
    if (ok) void qc.invalidateQueries({ queryKey: ['admin-chat-keywords'] });
  };

  /* ─── ТУРШИХ ─────────────────────────────────────────────── */
  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    reply?: string | null;
    titles?: { id: string; title: string }[];
  } | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const runTest = async () => {
    if (!testMsg.trim()) return;
    setTestBusy(true);
    try {
      const r = await api<{
        matched: boolean;
        reply?: string | null;
        titles?: { id: string; title: string }[];
      }>('/admin/chat-keywords/test', {
        method: 'POST',
        body: JSON.stringify({ message: testMsg.trim() }),
      });
      setTestResult(r);
    } catch {
      toast.error('Туршихад алдаа гарлаа');
    } finally {
      setTestBusy(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total]);

  return (
    <AdminShell>
      <AdminTopbar
        title="Чатботын түлхүүр үг"
        subtitle="Хэрэглэгч тодорхой үг бичихэд ямар кино/хариу гарахыг тохируулна"
      />

      <div className="space-y-5 p-4 sm:p-8">
        {/* ── ТУРШИХ ХАЙРЦАГ ── */}
        <div className="admin-card rounded-xl p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FlaskConical size={14} className="text-primary" />
            Туршиж үзэх
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runTest()}
              placeholder="Жишээ: 99"
              className="input-dark min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={runTest}
              disabled={testBusy || !testMsg.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
            >
              {testBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Шалгах
            </button>
          </div>

          {testResult && (
            <div
              className={cn(
                'mt-3 rounded-lg border p-3 text-sm',
                testResult.matched
                  ? 'border-success/30 bg-success/8'
                  : 'border-border bg-muted/40',
              )}
            >
              {testResult.matched ? (
                <>
                  <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-success">
                    <Check size={14} /> Дүрэм таарлаа
                  </p>
                  {testResult.reply && (
                    <p className="mb-1.5 text-foreground">💬 {testResult.reply}</p>
                  )}
                  {!!testResult.titles?.length && (
                    <p className="text-muted-foreground">
                      🎬 {testResult.titles.map((t) => t.title).join(' · ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <X size={14} /> Дүрэм олдсонгүй — энгийн хайлт ажиллана
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── ХЭРЭГСЛИЙН МӨР ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Түлхүүр, тэмдэглэлээр хайх…"
              className="input-dark w-full rounded-lg py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <Plus size={15} />
            Дүрэм нэмэх
          </button>
        </div>

        {/* ── ЖАГСААЛТ ── */}
        {isError ? (
          <AdminErrorState onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={6} />
        ) : !items.length ? (
          <TableEmptyState
            icon={Hash}
            message={debouncedQ ? 'Олдсонгүй' : 'Дүрэм алга'}
            description={
              debouncedQ
                ? 'Хайлтад тохирох дүрэм байхгүй.'
                : 'Жишээ: «99» гэж бичихэд «Өнчин охин» кино харуулах дүрэм нэмнэ үү.'
            }
          />
        ) : (
          <div className="admin-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Түлхүүр</th>
                    <th className="px-4 py-3 font-semibold">Хариу</th>
                    <th className="px-4 py-3 font-semibold">Төрөл</th>
                    <th className="px-4 py-3 text-right font-semibold">Ашигласан</th>
                    <th className="px-4 py-3 font-semibold">Төлөв</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((k) => (
                    <tr key={k.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {k.keywords.map((w) => (
                            <span
                              key={w}
                              className="rounded bg-primary/12 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                        {k.note && (
                          <p className="mt-1 text-xs text-muted-foreground">{k.note}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!!k.titles.length && (
                          <p className="text-foreground">
                            🎬 {k.titles.map((t) => t.title).join(' · ')}
                          </p>
                        )}
                        {k.reply && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            💬 {k.reply}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {MATCH_LABEL[k.matchType].label}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {k.hitCount}
                        {k.lastHitAt && (
                          <p className="text-[11px]">{formatDateTime(k.lastHitAt)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-semibold',
                            k.isActive
                              ? 'bg-success/15 text-success'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {k.isActive ? 'Идэвхтэй' : 'Унтраасан'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(k)}
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label="Засах"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => remove(k)}
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Устгах"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={setPage} />
        )}
      </div>

      {/* ── ФОРМ ── */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Шинэ дүрэм' : 'Дүрэм засах'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Түлхүүр үгс */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Түлхүүр үгс <span className="text-destructive">*</span>
              </label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="99, 999"
                className="input-dark w-full rounded-lg px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Таслалаар тусгаарлана. Том/жижиг үсэг, emoji, цэг таслал автоматаар
                хасагдана.
              </p>
            </div>

            {/* Тааруулах төрөл */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Хэрхэн тааруулах
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(MATCH_LABEL) as MatchType[]).map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => setForm({ ...form, matchType: mt })}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                      form.matchType === mt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {MATCH_LABEL[mt].label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {MATCH_LABEL[form.matchType].hint}
              </p>
            </div>

            {/* Кино сонгох */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Харуулах кино
              </label>
              {!!picked.length && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {picked.map((t) => (
                    <span
                      key={t.id}
                      className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs text-foreground"
                    >
                      {t.title}
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(picked.filter((x) => x.id !== t.id));
                          setForm({
                            ...form,
                            titleIds: form.titleIds.filter((id) => id !== t.id),
                          });
                        }}
                        aria-label="Хасах"
                        className="text-muted-foreground transition hover:text-destructive"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  value={titleQ}
                  onChange={(e) => setTitleQ(e.target.value)}
                  placeholder="Киноны нэрээр хайх…"
                  className="input-dark w-full rounded-lg px-3 py-2 text-sm"
                />
                {titleBusy && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
                  />
                )}
              </div>
              {!!titleHits.length && (
                <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-border">
                  {titleHits.map((t) => {
                    const has = form.titleIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={has}
                        onClick={() => {
                          setForm({ ...form, titleIds: [...form.titleIds, t.id] });
                          setPicked([...picked, { id: t.id, title: t.title }]);
                          setTitleQ('');
                          setTitleHits([]);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-muted disabled:opacity-40"
                      >
                        <span className="truncate">{t.title}</span>
                        {has && <Check size={14} className="shrink-0 text-success" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Сонгосон дараалал нь чатад ижил дарааллаар харагдана.
              </p>
            </div>

            {/* Текст хариу */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Нэмэлт текст хариу
              </label>
              <textarea
                value={form.reply}
                onChange={(e) => setForm({ ...form, reply: e.target.value })}
                rows={2}
                placeholder="Хоосон бол зөвхөн кино харагдана"
                className="input-dark w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Тэмдэглэл + эрэмбэ */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Тэмдэглэл (зөвхөн админд)
                </label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Өнчин охин — хочилсон нэр"
                  className="input-dark w-full rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Эрэмбэ
                </label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
                  className="input-dark w-full rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Идэвхтэй */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="size-4 rounded"
              />
              <span className="text-foreground">Идэвхтэй</span>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Болих
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Хадгалах
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
