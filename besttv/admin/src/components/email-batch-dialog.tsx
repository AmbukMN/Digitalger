'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MailOpen, Send } from 'lucide-react';
import { formatDateTime } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';

interface BatchItem {
  id: string;
  to: string;
  subject: string;
  status: string;
  openedAt: string | null;
  createdAt: string;
}

/**
 * НЭГ BULK ФОЛДЕРЫН ДЭЛГЭРЭНГҮЙ — модалд харуулна.
 *
 * ⚠️ Илгээсэн имэйлийн жагсаалтад bulk илгээлт бүр «фолдер» болж
 *    нэг мөр эзэлдэг. Дарахад энэ модал нээгдэж ДОТООД имэйлүүдийг
 *    (тус тусын хүлээн авагч, нээлт) пагинацитай харуулна.
 */
export function EmailBatchDialog({
  batchId,
  onClose,
}: {
  batchId: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);

  const { data, isFetching } = useQuery({
    queryKey: ['admin-email-batch', batchId, page],
    queryFn: () =>
      api<{
        label: string;
        subject: string | null;
        createdAt: string | null;
        total: number;
        sent: number;
        opened: number;
        items: BatchItem[];
        page: number;
        totalPages: number;
      }>(`/admin/email/logs/batch/${batchId}?page=${page}&limit=30`),
    placeholderData: (p) => p,
  });

  const openRate = data?.total ? Math.round(((data.opened ?? 0) / data.total) * 100) : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base leading-snug">
            {data?.label ?? 'Бөөн илгээлт'}
          </DialogTitle>
        </DialogHeader>

        {/* Хураангуй статистик */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Send size={13} /> Илгээсэн
            </div>
            <div className="mt-1 text-xl font-bold text-foreground">
              {(data?.sent ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MailOpen size={13} /> Нээсэн
            </div>
            <div className="mt-1 text-xl font-bold text-foreground">
              {(data?.opened ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Нээлт</div>
            <div className="mt-1 text-xl font-bold text-success">{openRate}%</div>
          </div>
        </div>

        {data?.createdAt && (
          <p className="text-xs text-muted-foreground">
            Илгээсэн: {formatDateTime(data.createdAt)} · Нийт {(data.total ?? 0).toLocaleString()}
          </p>
        )}

        {/* Хүлээн авагчдын жагсаалт */}
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-accent/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Хүлээн авагч</th>
                <th className="px-3 py-2 text-left font-semibold">Төлөв</th>
                <th className="px-3 py-2 text-left font-semibold">Нээсэн</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isFetching && !data ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : (
                data?.items.map((it) => (
                  <tr key={it.id}>
                    <td className="max-w-[280px] truncate px-3 py-2 text-foreground">{it.to}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          'rounded px-2 py-0.5 text-xs font-medium ' +
                          (it.status === 'sent'
                            ? 'bg-success/15 text-success'
                            : it.status === 'failed'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-muted text-muted-foreground')
                        }
                      >
                        {it.status === 'sent'
                          ? 'Илгээгдсэн'
                          : it.status === 'failed'
                            ? 'Амжилтгүй'
                            : it.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {it.openedAt ? formatDateTime(it.openedAt) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
        )}
      </DialogContent>
    </Dialog>
  );
}
