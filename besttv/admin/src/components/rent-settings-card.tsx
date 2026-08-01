'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@besttv/shared';
import { api } from '@/lib/api';

interface RentSettings {
  price: number;
  hours: number;
  enabled: boolean;
}

/**
 * Ширхэгээр түрээслэх — САЙТЫН НИЙТЛЭГ тохиргоо.
 *
 * ⚠️ Кино бүрт тусгайлан үнэ заасан бол (`rentPrice`) энэ нийтлэг үнийг
 * ДАРНА. Энд зөвхөн default-ыг тохируулна.
 */
export function RentSettingsCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-rent-settings'],
    queryFn: () => api<RentSettings>('/admin/rentals/settings'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const [price, setPrice] = useState('');
  const [hours, setHours] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPrice(String(data.price));
    setHours(String(data.hours));
    setEnabled(data.enabled);
  }, [data]);

  const save = async () => {
    const p = Number(price);
    const h = Number(hours);
    if (!Number.isFinite(p) || p < 0) return toast.error('Үнэ буруу байна');
    if (!Number.isFinite(h) || h < 1) return toast.error('Хугацаа хамгийн багадаа 1 цаг');
    setSaving(true);
    try {
      await api('/admin/rentals/settings', {
        method: 'PUT',
        body: JSON.stringify({ price: Math.round(p), hours: Math.round(h), enabled }),
      });
      qc.invalidateQueries({ queryKey: ['admin-rent-settings'] });
      toast.success('Түрээсийн тохиргоо хадгалагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!data && (String(data.price) !== price || String(data.hours) !== hours || data.enabled !== enabled);

  return (
    <div className="admin-card rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Ticket size={19} />
          </span>
          <div>
            <h2 className="font-bold text-foreground">Ширхэгээр түрээслэх</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Багц авалгүй нэг киног хугацаатай үзэх боломж. Кино бүрт тусад нь үнэ заавал энэ
              нийтлэг үнийг дарна.
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className={enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {enabled ? 'Идэвхтэй' : 'Идэвхгүй'}
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-muted/40" />
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Нийтлэг үнэ (₮)</span>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="admin-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Хугацаа (цаг)</span>
              <input
                type="number"
                min={1}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="admin-input"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Хэрэглэгч {formatPrice(Number(price) || 0)} төлөөд {hours || 0} цаг үзнэ
            </p>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              Хадгалах
            </button>
          </div>
        </>
      )}
    </div>
  );
}
