'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Phone, Trash2, MailOpen, MessageCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { adminApi, errMsg } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminContactMessage } from '@/types/admin';

// Огноог монголоор товч (YYYY-MM-DD HH:mm)
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ContactMessagesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [readFilter, setReadFilter] = useState<'ALL' | 'unread' | 'read'>('ALL');
  const [detail, setDetail] = useState<AdminContactMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminContactMessage | null>(null);

  const readParam =
    readFilter === 'unread' ? false : readFilter === 'read' ? true : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'contact-messages', { page, pageSize, readFilter }],
    queryFn: () => adminApi.contactMessages.list({ page, pageSize, read: readParam }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    qc.invalidateQueries({ queryKey: ['admin', 'contact-messages', 'unread-count'] });
  };

  const markReadMut = useMutation({
    mutationFn: (id: string) => adminApi.contactMessages.markRead(id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.contactMessages.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Устгагдлаа');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(errMsg(e, 'Устгахад алдаа гарлаа')),
  });

  // Дэлгэрэнгүй нээхэд уншаагүй бол автоматаар "Уншсан" болгоно.
  const openDetail = (m: AdminContactMessage) => {
    setDetail(m);
    if (!m.read) markReadMut.mutate(m.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <MessageCircle className="h-5 w-5 text-primary" />
            Холбоо барих мессеж
          </h1>
          <p className="text-sm text-muted-foreground">
            Сайтын “Холбоо барих” формоор ирсэн мессежүүд
          </p>
        </div>
        <Select value={readFilter} onValueChange={(v) => { setReadFilter(v as typeof readFilter); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Бүгд</SelectItem>
            <SelectItem value="unread">Уншаагүй</SelectItem>
            <SelectItem value="read">Уншсан</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Mail className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Мессеж алга</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Илгээгч</th>
                    <th className="px-4 py-2.5 font-medium">Холбоо барих</th>
                    <th className="px-4 py-2.5 font-medium">Мессеж</th>
                    <th className="px-4 py-2.5 font-medium">Огноо</th>
                    <th className="px-4 py-2.5 font-medium">Төлөв</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => openDetail(m)}
                      className={
                        'cursor-pointer border-b border-border transition-colors hover:bg-muted/50 ' +
                        (m.read ? '' : 'bg-muted font-medium')
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{m.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {m.email}
                          </span>
                          {m.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {m.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <span className="line-clamp-2 text-muted-foreground">{m.message}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDate(m.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {m.read ? (
                          <Badge variant="secondary">Уншсан</Badge>
                        ) : (
                          <Badge className="bg-red-500 text-white hover:bg-red-500">Шинэ</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-red-50 dark:bg-red-950/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(m);
                          }}
                          aria-label="Устгах"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(s) => { setPageSize(s); setPage(1); }}
      />

      {/* ─── Дэлгэрэнгүй ─── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailOpen className="h-5 w-5 text-primary" />
              {detail?.name}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[80px_1fr] gap-y-2">
                <span className="text-muted-foreground">И-мэйл</span>
                <a href={`mailto:${detail.email}`} className="break-all text-primary hover:underline">
                  {detail.email}
                </a>
                {detail.phone && (
                  <>
                    <span className="text-muted-foreground">Утас</span>
                    <a href={`tel:${detail.phone}`} className="text-primary hover:underline">
                      {detail.phone}
                    </a>
                  </>
                )}
                {detail.subject && (
                  <>
                    <span className="text-muted-foreground">Гарчиг</span>
                    <span>{detail.subject}</span>
                  </>
                )}
                <span className="text-muted-foreground">Огноо</span>
                <span>{fmtDate(detail.createdAt)}</span>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 whitespace-pre-wrap text-foreground">
                {detail.message}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Хаах
            </Button>
            {detail && (
              <Button asChild>
                <a href={`mailto:${detail.email}?subject=${encodeURIComponent('RE: DigitalGer холбоо барих')}`}>
                  <Mail className="mr-2 h-4 w-4" /> Имэйлээр хариулах
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Устгах баталгаажуулалт ─── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Мессеж устгах уу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{deleteTarget?.name}”-ийн мессежийг бүрмөсөн устгах гэж байна. Энэ үйлдлийг буцаах боломжгүй.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Болих
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
