'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

/**
 * ХАДГАЛСАН КАРТУУД — профайлд.
 *
 * ⚠️⚠️ КАРТЫН ДУГААР ЭНД ХЭЗЭЭ Ч ИРЭХГҮЙ. Backend нь зөвхөн МАСК
 * (`5150 23** **** 4778`), банк, хугацааг буцаадаг. Bonum-ын токен
 * серверээс ГАДАГШ гардаггүй — задарвал тухайн картаас төлбөр татах
 * боломжтой болно.
 *
 * ⚠️ Карт БАЙХГҮЙ бол энэ хэсэг ОГТ ГАРАХГҮЙ — хоосон карт харуулах нь
 * хэрэглэгчийг «юу хийх ёстой юм бол?» гэж эргэлзүүлнэ. Карт нь багц
 * худалдан авахад автоматаар хадгалагддаг.
 */
interface SavedCard {
  id: string;
  mask: string;
  bank: string;
  expiry: string;
  isDefault: boolean;
}

export function SavedCardsCard() {
  const { user, refreshMe } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: cards, isLoading } = useQuery<SavedCard[]>({
    queryKey: ['saved-cards'],
    queryFn: () => api<SavedCard[]>('/payments/cards'),
    enabled: !!user,
    staleTime: 60_000,
  });

  /* ⚠️ Ачаалж байхад ч, хоосон ч бол юу ч харуулахгүй */
  if (isLoading || !cards?.length) return null;

  const remove = async (card: SavedCard) => {
    /* ⚠️ ЗААВАЛ баталгаажуулна — устгавал автомат сунгалт ч зогсоно */
    const ok = await confirm({
      title: 'Картыг устгах уу?',
      description: `${card.mask} — устгавал энэ картаар хийгддэг автомат сунгалт зогсоно.`,
      confirmLabel: 'Устгах',
      tone: 'danger',
    });
    if (!ok) return;

    setDeletingId(card.id);
    try {
      await api(`/payments/cards/${card.id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['saved-cards'] });
      /* ⚠️ Багцын autoRenew төлөв ч өөрчлөгдсөн тул хэрэглэгчийг шинэчилнэ */
      await refreshMe();
      toast.success('Карт устгагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-card p-4">
      <div className="flex items-center gap-2">
        <CreditCard size={15} className="text-foreground/60" />
        <span className="text-sm font-semibold text-foreground/85">Хадгалсан карт</span>
      </div>

      <div className="mt-3 space-y-2">
        {cards.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tabular-nums text-foreground/90">
                {c.mask}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-foreground/45">
                {[c.bank, c.expiry].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(c)}
              disabled={deletingId === c.id}
              aria-label="Карт устгах"
              className="shrink-0 rounded-md p-2 text-foreground/45 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              {deletingId === c.id ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-foreground/40">
        Картын дугаарыг бид хадгалдаггүй — төлбөрийн байгууллага дээр аюулгүй хадгалагдана.
      </p>
    </div>
  );
}
