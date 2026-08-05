'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';

/**
 * Админ жагсаалтын ОЛНООР СОНГОХ + УСТГАХ логик.
 *
 * ⚠️ ГУРВАН хуудас (хэрэглэгч / чат / имэйл) ижил зан төлөвтэй тул код
 * ДАВХАРДУУЛАХГҮЙН тулд нэг hook болгов. Нэг газар засвал бүгдэд нөлөөлнө
 * (өмнө нь каталогийн `GridCard` давхардсанаас эрхийн алдаа гарч байсан).
 *
 * Хэрэглээ:
 *   const sel = useBulkSelect({ endpoint: '/admin/chat/conversations/bulk-delete',
 *                               invalidate: ['admin-chat'] });
 *   ...
 *   <BulkBar {...sel.bar} />
 *   <input type="checkbox" checked={sel.isSelected(id)} onChange={() => sel.toggle(id)} />
 */
export function useBulkSelect({
  endpoint,
  invalidate,
  label = 'бичлэг',
}: {
  /** POST хийх backend зам — `{ ids: string[] }` хүлээж авна */
  endpoint: string;
  /** Устгасны дараа шинэчлэх query key-нүүд (prefix таарвал болно) */
  invalidate: string[];
  /** Мессежид гарах нэр: "3 хэрэглэгч устлаа" */
  label?: string;
}) {
  const qc = useQueryClient();
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => new Set(ids), [ids]);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  /**
   * Хуудсан дээрх БҮГДИЙГ сонгох/болиулах.
   * ⚠️ Зөвхөн ОДООГИЙН хуудсын мөрүүд — өөр хуудсанд сонгосон нь хэвээр
   * үлдэнэ (хуудас солиод үргэлжлүүлж сонгох боломжтой).
   */
  const toggleAll = useCallback((pageIds: string[]) => {
    setIds((prev) => {
      const allOn = pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
      return allOn ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])];
    });
  }, []);

  const allChecked = useCallback(
    (pageIds: string[]) => pageIds.length > 0 && pageIds.every((id) => selected.has(id)),
    [selected],
  );

  const remove = useCallback(async () => {
    if (!ids.length || busy) return;
    if (!confirm(`Сонгосон ${ids.length} ${label}-ийг бүрмөсөн устгах уу? Буцаах боломжгүй.`)) return;
    setBusy(true);
    try {
      /**
       * ⚠️ Backend `{ deleted, skipped? }` буцаана. Хэрэглэгч устгахад
       * хамгаалалтад тээглэсэн мөрүүд `skipped`-д ирнэ — ЧИМЭЭГҮЙ
       * алгасвал админ "устсан" гэж эндүүрнэ.
       */
      const res = await api<{ deleted: number; skipped?: { email: string; reason: string }[] }>(
        endpoint,
        { method: 'POST', body: JSON.stringify({ ids }) },
      );
      if (res.deleted > 0) toast.success(`${res.deleted} ${label} устлаа`);
      if (res.skipped?.length) {
        toast.warning(
          `${res.skipped.length} мөр алгасагдлаа: ${res.skipped
            .slice(0, 3)
            .map((s) => `${s.email} (${s.reason})`)
            .join(', ')}${res.skipped.length > 3 ? '…' : ''}`,
          { duration: 8000 },
        );
      }
      if (!res.deleted && !res.skipped?.length) toast.info('Юу ч устсангүй');
      clear();
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгахад алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }, [ids, busy, endpoint, invalidate, label, qc, clear]);

  return {
    ids,
    count: ids.length,
    isSelected,
    toggle,
    toggleAll,
    allChecked,
    clear,
    remove,
    busy,
    bar: { count: ids.length, onClear: clear, onDelete: remove, busy, label },
  };
}

/**
 * Сонголт идэвхтэй үед доод талд гарах ТОГТМОЛ мөр.
 * ⚠️ `fixed bottom` — урт жагсаалтад гүйлгэсэн ч товч алга болохгүй.
 */
export function BulkBar({
  count,
  onClear,
  onDelete,
  busy,
  label = 'бичлэг',
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  busy: boolean;
  label?: string;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-5">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl">
        <span className="text-sm font-semibold">
          {count} {label} сонгосон
        </span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <X size={13} /> Болих
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Устгах
        </button>
      </div>
    </div>
  );
}

/** Хүснэгтийн мөр/толгойд тавих checkbox — гурван хуудсанд ижил харагдац */
export function SelectBox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer accent-primary"
    />
  );
}
