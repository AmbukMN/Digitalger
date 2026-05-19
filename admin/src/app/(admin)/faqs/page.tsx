'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  Loading,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  active: boolean;
  sortOrder: number;
  _count?: { products: number };
}

const emptyForm = { question: '', answer: '', category: '', sortOrder: 0, active: true };

function FaqDialog({
  open, faq, onClose, onSaved,
}: { open: boolean; faq: FAQ | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm(faq
        ? { question: faq.question, answer: faq.answer, category: faq.category ?? '', sortOrder: faq.sortOrder, active: faq.active }
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
      };
      return faq
        ? adminApi.faqs.update(faq.id, payload)
        : adminApi.faqs.create(payload);
    },
    onSuccess: () => { toast.success('Хадгалагдлаа'); onSaved(); },
    onError: () => toast.error('Алдаа гарлаа'),
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

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
            <span className="text-sm">Идэвхтэй</span>
          </label>

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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: () => adminApi.faqs.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.faqs.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] }); toast.success('Устгагдлаа'); },
  });

  if (isLoading) return <Loading label="FAQ ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  // Group by category
  const grouped = (data ?? []).reduce<Record<string, FAQ[]>>((acc, faq) => {
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
                          {faq._count?.products ? (
                            <Badge variant="outline" className="text-xs shrink-0">{faq._count.products} бүтээгдэхүүн</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{faq.answer}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(faq); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Устгах уу?')) deleteMut.mutate(faq.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FaqDialog
        open={dialogOpen}
        faq={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] }); }}
      />
    </div>
  );
}
