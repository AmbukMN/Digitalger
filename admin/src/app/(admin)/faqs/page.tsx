'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, HelpCircle, Search } from 'lucide-react';
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
  ErrorState,
  Input,
  Label,
  Loading,
  StatCard,
  StatsGrid,
} from '@digitalger/shared/ui';
import { adminApi, errMsg } from '@/lib/api';
import { useCurrentAdmin } from '@/hooks/use-current-admin';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  active: boolean;
  showInHelp?: boolean;
  sortOrder: number;
  createdByUserId?: string | null;
  _count?: { products: number };
}

const emptyForm = { question: '', answer: '', category: '', sortOrder: 0, active: true, showInHelp: false };

function FaqDialog({
  open, faq, onClose, onSaved,
}: { open: boolean; faq: FAQ | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm(faq
        ? { question: faq.question, answer: faq.answer, category: faq.category ?? '', sortOrder: faq.sortOrder, active: faq.active, showInHelp: faq.showInHelp ?? false }
        : emptyForm
      );
    }
  }, [open, faq?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        question: form.question,
        answer: form.answer,
        category: form.category || undefined,
        sortOrder: form.sortOrder,
        active: form.active,
        showInHelp: form.showInHelp,
      };
      return faq
        ? adminApi.faqs.update(faq.id, payload)
        : adminApi.faqs.create(payload);
    },
    onSuccess: () => { toast.success('Хадгалагдлаа'); onSaved(); },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{faq ? 'FAQ засах' : 'FAQ нэмэх'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ангилал</Label>
              <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Жишээ нь: Төлбөр, Татах" />
            </div>
            <div className="space-y-2">
              <Label>Дараалал</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} min={0} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Асуулт *</Label>
            <Input value={form.question} onChange={(e) => setForm(f => ({ ...f, question: e.target.value }))} placeholder="Хэрэглэгчийн түгээмэл асуулт" required />
          </div>

          <div className="space-y-2">
            <Label>Хариулт *</Label>
            <textarea
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.answer}
              onChange={(e) => setForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="Дэлгэрэнгүй хариулт..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
              <span className="text-sm">Идэвхтэй</span>
            </label>
            {/* Help Assistant самбарын FAQ tab-д харуулах эсэх */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.showInHelp} onChange={(e) => setForm(f => ({ ...f, showInHelp: e.target.checked }))} />
              <span className="text-sm">Туслах самбарт (Help) харуулах</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Болих</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Хадгалж...' : 'Хадгалах'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FaqsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
  const [search, setSearch] = useState('');
  const { canModify } = useCurrentAdmin();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: () => adminApi.faqs.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.faqs.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] }); toast.success('Устгагдлаа'); setDeleteTarget(null); },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа')),
  });

  if (isLoading) return <Loading label="FAQ ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  const all = data ?? [];
  // Статистик
  const total = all.length;
  const activeCount = all.filter((f) => f.active).length;
  const helpCount = all.filter((f) => f.showInHelp).length;
  // Хайлт (асуулт/хариулт/ангилал)
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || (f.category ?? '').toLowerCase().includes(q))
    : all;
  // Group by category (шүүсэн дата дээр)
  const grouped = filtered.reduce<Record<string, FAQ[]>>((acc, faq) => {
    const cat = faq.category ?? 'Бусад';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Түгээмэл асуулт</h1>
          <p className="text-muted-foreground">Бүх FAQ-уудыг удирдах. Бүтээгдэхүүнд оноохыг бүтээгдэхүүн засахад хийнэ.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> FAQ нэмэх
        </Button>
      </div>

      {/* Статистик */}
      {total > 0 && (
        <StatsGrid className="sm:grid-cols-3">
          <StatCard label="Нийт" value={total} />
          <StatCard label="Идэвхтэй" value={activeCount} variant="success" />
          <StatCard label="Туслах самбарт" value={helpCount} variant="primary" />
        </StatsGrid>
      )}

      {/* Хайлт */}
      {total > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Асуулт, хариулт, ангиллаар хайх..." className="pl-9" />
        </div>
      )}

      {!data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">FAQ байхгүй байна</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Анхны FAQ нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, faqs]) => (
            <Card key={cat}>
              <div className="border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-muted-foreground">{cat}</span>
              </div>
              <CardContent className="p-0">
                <div className="divide-y">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{faq.question}</p>
                          <Badge variant={faq.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {faq.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                          </Badge>
                          {faq.showInHelp ? (
                            <Badge variant="outline" className="text-xs shrink-0 border-primary/40 text-primary">Help</Badge>
                          ) : null}
                          {faq._count?.products ? (
                            <Badge variant="outline" className="text-xs shrink-0">{faq._count.products} бүтээгдэхүүн</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{faq.answer}</p>
                      </div>
                      {/* Зөвхөн өөрийн (эсвэл SUPERADMIN) контентод edit/delete */}
                      {canModify(faq) ? (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(faq); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-red-50 dark:bg-red-950/40"
                            onClick={() => setDeleteTarget(faq)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10px] italic text-muted-foreground/70" title="Өөр админы контент">
                          Өөр админ
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>FAQ устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium line-clamp-2">{deleteTarget.question}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">FAQ-г бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FaqDialog
        open={dialogOpen}
        faq={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] }); }}
      />
    </div>
  );
}
