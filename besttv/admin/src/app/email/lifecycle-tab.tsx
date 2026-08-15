'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';

interface LifecycleFlow {
  campaign: string;
  label: string;
  description: string;
  isEnabled: boolean;
  subject: string;
  heading: string;
  bodyHtml: string;
  ctaText: string;
  couponPercent: number;
  couponDays: number;
  /** Админ засварласан эсэх (DB-д мөр байгаа эсэх) */
  customized: boolean;
}

interface LifecycleStat {
  campaign: string;
  label: string;
  sent: number;
  opened: number;
  openRate: number;
  couponsIssued: number;
  couponsUsed: number;
  conversionRate: number;
}

/**
 * АВТОМАТ ИМЭЙЛ — өдөрт нэг удаа өөрөө ажилладаг урсгалууд.
 *
 * ⚠️ Энэ таб нь ЗӨВХӨН тохиргоо биш — ҮР ДҮНГ ч харуулна. «Хэдэн
 * илгээснийг» ганцаараа мэдэх нь утгагүй; нээлт болон КУПОН
 * АШИГЛАЛТ (бодит хөрвөлт) хамт байж «энэ имэйл мөнгө авчирсан уу?»
 * гэсэн жинхэнэ асуултад хариулна.
 */
export function LifecycleTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LifecycleFlow | null>(null);

  const { data: flows, isLoading } = useQuery({
    queryKey: ['admin-lifecycle'],
    queryFn: () => api<LifecycleFlow[]>('/admin/email/lifecycle'),
    staleTime: 0,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-lifecycle-stats'],
    queryFn: () => api<LifecycleStat[]>('/admin/email/lifecycle/stats?days=30'),
    staleTime: 0,
  });

  const statOf = (c: string) => stats?.find((s) => s.campaign === c);

  const toggle = async (f: LifecycleFlow) => {
    await runMutation(
      () =>
        api(`/admin/email/lifecycle/${f.campaign}`, {
          method: 'POST',
          body: JSON.stringify({ ...f, isEnabled: !f.isEnabled }),
        }),
      {
        success: f.isEnabled ? 'Унтраалаа' : 'Асаалаа',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-lifecycle'] }),
      },
    );
  };

  return (
    <>
      <div className="mb-5 rounded-lg border border-primary/25 bg-primary/8 p-3.5 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Өдөр бүр 19:00 цагт автоматаар ажиллана.</strong>{' '}
        Багцаа сунгаагүй, худалдан авалт хийгээгүй, удаан ороогүй хэрэглэгчид рүү имэйл болон
        хонхны мэдэгдэл илгээнэ.{' '}
        <strong className="text-foreground">Купон нь хүн тус бүрд өөр</strong> — нэг хүн нэг удаа
        л ашиглана, бусдад дамжуулж болохгүй.
      </div>

      {isLoading ? (
        <TableEmptyState icon={Mail} message="Уншиж байна…" />
      ) : (
        <div className="space-y-2.5">
          {flows?.map((f) => {
            const st = statOf(f.campaign);
            return (
              <div
                key={f.campaign}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  f.isEnabled ? 'border-border bg-card' : 'border-border/50 bg-foreground/2',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3
                        className={cn(
                          'text-sm font-bold',
                          f.isEnabled ? 'text-foreground' : 'text-foreground/45',
                        )}
                      >
                        {f.label}
                      </h3>
                      {f.couponPercent > 0 && (
                        <span className="rounded bg-premium/15 px-1.5 py-0.5 text-[10px] font-bold text-premium">
                          {f.couponPercent}% купон · {f.couponDays} хоног
                        </span>
                      )}
                      {f.customized && (
                        <span className="rounded bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Засварласан
                        </span>
                      )}
                      {!f.isEnabled && (
                        <span className="rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/50">
                          Унтраалттай
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setEditing(f)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
                    >
                      Засах
                    </button>
                    {/*
                      ⚠️ Асаах/унтраах — админ тодорхой имэйл таалагдахгүй бол
                      кодыг хөндөхгүйгээр зогсоох боломжтой байх ЁСТОЙ.
                    */}
                    <button
                      onClick={() => toggle(f)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                        f.isEnabled
                          ? 'bg-success/15 text-success hover:bg-success/25'
                          : 'bg-foreground/8 text-foreground/50 hover:bg-foreground/15',
                      )}
                    >
                      {f.isEnabled ? 'Асаалттай' : 'Унтраалттай'}
                    </button>
                  </div>
                </div>

                {/* ─── 30 хоногийн үр дүн ─── */}
                {st && st.sent > 0 && (
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-2.5 text-[11px]">
                    <Metric label="Илгээсэн" value={String(st.sent)} />
                    <Metric
                      label="Нээсэн"
                      value={`${st.opened} (${st.openRate}%)`}
                      tone={st.openRate >= 25 ? 'good' : st.openRate >= 10 ? 'mid' : 'bad'}
                    />
                    {st.couponsIssued > 0 && (
                      <>
                        <Metric label="Купон олгосон" value={String(st.couponsIssued)} />
                        {/*
                          ⚠️ ХӨРВӨЛТ — хамгийн чухал үзүүлэлт. Купон ашигласан
                          гэдэг нь ХУДАЛДАН АВАЛТ болсон гэсэн үг.
                        */}
                        <Metric
                          label="Ашигласан"
                          value={`${st.couponsUsed} (${st.conversionRate}%)`}
                          tone={
                            st.conversionRate >= 5
                              ? 'good'
                              : st.conversionRate >= 1
                                ? 'mid'
                                : 'bad'
                          }
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <LifecycleEditor
          flow={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['admin-lifecycle'] });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'mid' | 'bad';
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <strong
        className={cn(
          'font-bold',
          tone === 'good' && 'text-success',
          tone === 'mid' && 'text-warning',
          tone === 'bad' && 'text-foreground/50',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </strong>
    </span>
  );
}

/** Загвар засах модал */
function LifecycleEditor({
  flow,
  onClose,
  onSaved,
}: {
  flow: LifecycleFlow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    subject: flow.subject,
    heading: flow.heading,
    bodyHtml: flow.bodyHtml,
    ctaText: flow.ctaText,
    couponPercent: flow.couponPercent,
    couponDays: flow.couponDays,
    isEnabled: flow.isEnabled,
  });
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const save = async () => {
    setSaving(true);
    const ok = await runMutation(
      () =>
        api(`/admin/email/lifecycle/${flow.campaign}`, {
          method: 'POST',
          body: JSON.stringify(f),
        }),
      { success: 'Хадгаллаа' },
    );
    setSaving(false);
    if (ok) onSaved();
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Анхдагч руу буцаах уу?',
      description: 'Таны бичсэн текст устаж, системийн үндсэн загвар ажиллана.',
      tone: 'warning',
      confirmLabel: 'Буцаах',
    });
    if (!ok) return;
    await runMutation(
      () => api(`/admin/email/lifecycle/${flow.campaign}/reset`, { method: 'POST' }),
      { success: 'Анхдагч руу буцаалаа', onDone: onSaved },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{flow.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          {/*
            ⚠️ ОРЛУУЛГЫН ТҮЛХҮҮР — админ эдгээрийг мэдэхгүй бол купоны
            код имэйлд ОГТ ОРОХГҮЙ. Заавал ил харуулна.
          */}
          <div className="rounded-lg border border-border bg-accent/40 p-3 text-[11px] leading-relaxed">
            <p className="mb-1 font-bold text-foreground">Орлуулах түлхүүрүүд:</p>
            <p className="text-muted-foreground">
              <code className="rounded bg-foreground/10 px-1">{'{{coupon}}'}</code> — купоны код ·{' '}
              <code className="rounded bg-foreground/10 px-1">{'{{percent}}'}</code> — хямдралын
              хувь · <code className="rounded bg-foreground/10 px-1">{'{{expires}}'}</code> —
              купон дуусах огноо
              {flow.campaign === 'wallet-idle' && (
                <>
                  {' '}
                  · <code className="rounded bg-foreground/10 px-1">{'{{balance}}'}</code> —
                  хэтэвчний үлдэгдэл
                </>
              )}
            </p>
            <p className="mt-1.5 text-muted-foreground">
              Хоосон үлдээвэл системийн анхдагч текст ажиллана.
            </p>
          </div>

          <Field label="Гарчиг (subject)">
            <input
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
              placeholder="Хоосон = анхдагч"
              className={LC_INPUT}
            />
          </Field>

          <Field label="Дотоод том гарчиг">
            <input
              value={f.heading}
              onChange={(e) => setF({ ...f, heading: e.target.value })}
              placeholder="Хоосон = анхдагч"
              className={LC_INPUT}
            />
          </Field>

          <Field label="Үндсэн текст (HTML зөвшөөрнө)">
            <textarea
              value={f.bodyHtml}
              onChange={(e) => setF({ ...f, bodyHtml: e.target.value })}
              rows={7}
              placeholder="Хоосон = анхдагч"
              className={cn(LC_INPUT, 'resize-y font-mono text-xs')}
            />
          </Field>

          <Field label="Товчны текст">
            <input
              value={f.ctaText}
              onChange={(e) => setF({ ...f, ctaText: e.target.value })}
              placeholder="Хоосон = анхдагч"
              className={LC_INPUT}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Купоны хямдрал (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={f.couponPercent}
                onChange={(e) => setF({ ...f, couponPercent: Number(e.target.value) })}
                className={LC_INPUT}
              />
              {/* ⚠️ 0 нь купон ОГТ өгөхгүй гэсэн үг — админ андуурч болзошгүй */}
              <p className="mt-1 text-[10px] text-muted-foreground">0 = купон өгөхгүй</p>
            </Field>
            <Field label="Купон хүчинтэй (хоног)">
              <input
                type="number"
                min={0}
                max={365}
                value={f.couponDays}
                onChange={(e) => setF({ ...f, couponDays: Number(e.target.value) })}
                className={LC_INPUT}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
            <button
              onClick={reset}
              disabled={!flow.customized}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-foreground/5 disabled:opacity-40"
            >
              Анхдагч руу буцаах
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-foreground/5"
              >
                Болих
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LC_INPUT =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
