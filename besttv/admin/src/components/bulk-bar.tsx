'use client';

import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Trash2, Unlock, X } from 'lucide-react';

export interface BulkImpact {
  total: number;
  totalActiveRentals: number;
  totalRentalAmount: number;
  withActiveRentals: { id: string; title: string; activeRentals: number }[];
  items: { id: string; title: string; views: number; inMyList: number; reviews: number }[];
}

/**
 * Сонгосон мөрүүд дээрх бөөн үйлдлийн мөр.
 *
 * ⚠️ Устгах нь ЭРГЭЖ БУЦАХГҮЙ (R2-гийн файл ч устана) тул:
 *   1. Эхлээд НӨЛӨӨЛЛИЙГ (impact) харуулна
 *   2. Идэвхтэй ТҮРЭЭС байвал улаан анхааруулга + тусдаа баталгаажуулалт
 *      (Rental нь Cascade — төлбөр төлсөн хэрэглэгч эрхээ алдана)
 */
export function BulkBar({
  count,
  onClear,
  onDelete,
  onSetActive,
  onSetPremium,
  loadImpact,
}: {
  count: number;
  onClear: () => void;
  onDelete: (force: boolean) => Promise<void>;
  onSetActive: (isActive: boolean) => Promise<void>;
  onSetPremium: (isPremium: boolean) => Promise<void>;
  loadImpact: () => Promise<BulkImpact>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [impact, setImpact] = useState<BulkImpact | null>(null);
  const [typed, setTyped] = useState('');

  if (count === 0) return null;

  const openConfirm = async () => {
    setBusy(true);
    try {
      setImpact(await loadImpact());
      setTyped('');
      setConfirming(true);
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const hasRentals = (impact?.totalActiveRentals ?? 0) > 0;
  // ⚠️ Түрээстэй бол "УСТГАХ" гэж бичиж баталгаажуулна (санамсаргүй дарахаас)
  const canDelete = !hasRentals || typed.trim().toUpperCase() === 'УСТГАХ';

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          {count} контент сонгосон
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <BulkBtn onClick={() => run(() => onSetActive(true))} disabled={busy} icon={<Eye size={14} />}>
            Нийтлэх
          </BulkBtn>
          <BulkBtn onClick={() => run(() => onSetActive(false))} disabled={busy} icon={<EyeOff size={14} />}>
            Нуух
          </BulkBtn>
          <BulkBtn onClick={() => run(() => onSetPremium(true))} disabled={busy} icon={<Lock size={14} />}>
            Төлбөртэй
          </BulkBtn>
          <BulkBtn onClick={() => run(() => onSetPremium(false))} disabled={busy} icon={<Unlock size={14} />}>
            Үнэгүй
          </BulkBtn>

          <button
            type="button"
            onClick={openConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Устгах
          </button>

          <button
            type="button"
            onClick={onClear}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Сонголт цуцлах"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Устгах баталгаажуулалт ── */}
      {confirming && impact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            className="admin-dropdown w-full max-w-lg rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-destructive/12 p-2 text-destructive">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  {impact.total} контент устгах уу?
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Видео, зураг, HLS файлууд Cloudflare R2-оос БҮРМӨСӨН устана. Энэ үйлдлийг
                  буцаах боломжгүй.
                </p>
              </div>
            </div>

            {/* ⚠️ Идэвхтэй түрээс — мөнгө төлсөн хэрэглэгч эрхээ алдана */}
            {hasRentals && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/8 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle size={14} />
                  {impact.totalActiveRentals} идэвхтэй түрээс устана
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Нийт {impact.totalRentalAmount.toLocaleString()}₮ төлсөн хэрэглэгчид эрхээ
                  алдана. Тэдэнд буцаалт хийх шаардлагатай байж болно.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {impact.withActiveRentals.slice(0, 5).map((t) => (
                    <li key={t.id} className="truncate text-[11px] text-muted-foreground">
                      • {t.title} — {t.activeRentals} түрээс
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Нөлөөллийн товч тайлан */}
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-[11px]">
                <thead className="bg-accent/50 text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-medium">Гарчиг</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Үзэлт</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Дуртай</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {impact.items.map((t) => (
                    <tr key={t.id}>
                      <td className="max-w-[220px] truncate px-2.5 py-1.5 text-foreground">
                        {t.title}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                        {t.views.toLocaleString()}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                        {t.inMyList}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasRentals && (
              <label className="mt-3 block">
                <span className="text-[11px] text-muted-foreground">
                  Баталгаажуулахын тулд <strong className="text-foreground">УСТГАХ</strong> гэж
                  бичнэ үү
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-destructive"
                  placeholder="УСТГАХ"
                />
              </label>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Болих
              </button>
              <button
                type="button"
                disabled={busy || !canDelete}
                onClick={() =>
                  run(async () => {
                    await onDelete(hasRentals);
                    setConfirming(false);
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Бүрмөсөн устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BulkBtn({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}
