'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, Copy, MessageCircle, X } from 'lucide-react';
import { formatPrice } from '@digitalger/shared';
import { useChatUi } from '@/store/chat-ui';
import type { PublicSiteSettings } from '@/lib/api';

interface BankTransferModalProps {
  settings: Pick<
    PublicSiteSettings,
    'bankName' | 'bankAccountNumber' | 'bankAccountName' | 'bankTransferNote'
  >;
  total: number;
  onClose: () => void;
}

// Хуулах товчтой мэдээллийн мөр (данс дугаар, эзэмшигч г.м)
function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API боломжгүй хуучин browser — чимээгүй өнгөрнө
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-semibold ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted active:scale-95"
        aria-label={`${label} хуулах`}
      >
        {copied ? (
          <><Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> Хууллаа</>
        ) : (
          <><Copy className="h-3.5 w-3.5" /> Хуулах</>
        )}
      </button>
    </div>
  );
}

export function BankTransferModal({ settings, total, onClose }: BankTransferModalProps) {
  const { bankName, bankAccountNumber, bankAccountName, bankTransferNote } = settings;
  const requestOpenChat = useChatUi((s) => s.requestOpenChat);

  // "Чатаар холбогдох" → вэбийн AI/туслах чат widget-ыг нээнэ (Facebook БИШ).
  // Modal-ыг хаагаад чат нээгдэнэ.
  const openWebChat = () => {
    onClose();
    // Modal-ын exit animation дуустал бага зэрэг хүлээгээд чат нээнэ.
    setTimeout(() => requestOpenChat(), 120);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="bank-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        key="bank-modal"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Дансаар төлөх"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Дансаар шилжүүлэх</p>
              <p className="text-[10px] leading-tight text-muted-foreground">Данс руу шилжүүлээд бидэнтэй холбогдоно уу</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Хаах"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {/* Төлөх дүн */}
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
            <span className="text-sm font-medium text-muted-foreground">Төлөх дүн</span>
            <span className="text-lg font-bold text-primary tabular-nums">{formatPrice(total)}</span>
          </div>

          {/* Данс мэдээлэл */}
          {bankName && (
            <CopyRow label="Банк" value={bankName} />
          )}
          {bankAccountNumber && (
            <CopyRow label="Дансны дугаар" value={bankAccountNumber} mono />
          )}
          {bankAccountName && (
            <CopyRow label="Данс эзэмшигч" value={bankAccountName} />
          )}

          {/* Заавар/гуйвуулгын утга */}
          {bankTransferNote && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-3 dark:bg-amber-950/20">
              <p className="whitespace-pre-line text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                {bankTransferNote}
              </p>
            </div>
          )}

          {/* Заавар алхмууд */}
          <div className="rounded-xl border border-border bg-muted/20 px-3.5 py-3">
            <p className="mb-2 text-xs font-semibold">Хэрхэн авах вэ?</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Дээрх данс руу яг төлөх дүнг шилжүүлнэ.</li>
              <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Бидэнд чат бичиж, шилжүүлсэн баримтаа илгээнэ.</li>
              <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Бид баталгаажуулаад бүтээгдэхүүнийг тань нээж өгнө.</li>
            </ol>
          </div>

          {/* Холбоо барих — вэбийн туслах чат widget нээнэ (Facebook БИШ) */}
          <button
            type="button"
            onClick={openWebChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            Чатаар холбогдох
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
