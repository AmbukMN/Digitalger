'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Navigation } from 'lucide-react';
import {
  Button, Badge, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  ErrorState, Input, Label, Loading,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { AdminMenuItem } from '@/types/admin';

const emptyForm = {
  label: '', url: '', pageSlug: '', active: true, openInNew: false, target: '_self',
};

function MenuItemDialog({
  open, item, onClose, onSaved,
}: { open: boolean; item: AdminMenuItem | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<'url' | 'page'>('url');

  useEffect(() => {
    if (open) {
      if (item) {
        setForm({
          label: item.label,
          url: item.url ?? '',
          pageSlug: item.pageSlug ?? '',
          active: item.active,
          openInNew: item.openInNew,
          target: item.target,
        });
        setMode(item.pageSlug ? 'page' : 'url');
      } else {
        setForm(emptyForm);
        setMode('url');
      }
    }
  }, [open, item?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        label: form.label,
        url: mode === 'url' ? (form.url || undefined) : undefined,
        pageSlug: mode === 'page' ? (form.pageSlug || undefined) : undefined,
        active: form.active,
        openInNew: form.openInNew,
        target: form.openInNew ? '_blank' : '_self',
      };
      return item
        ? adminApi.menu.update(item.id, payload)
        : adminApi.menu.create(payload);
    },
    onSuccess: () => { toast.success('Хадгалагдлаа'); onSaved(); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Цэс засах' : 'Цэс нэмэх'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2">
            <Label>Гарчиг *</Label>
            <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Нүүр хуудас" required />
          </div>

          <div className="space-y-2">
            <Label>Холбоосын төрөл</Label>
            <div className="flex gap-2">
              <Button type="button" variant={mode === 'url' ? 'default' : 'outline'} size="sm" onClick={() => setMode('url')}>Гадаад URL</Button>
              <Button type="button" variant={mode === 'page' ? 'default' : 'outline'} size="sm" onClick={() => setMode('page')}>Сайтын хуудас</Button>
            </div>
          </div>

          {mode === 'url' ? (
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com эсвэл /about" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Хуудасны slug</Label>
              <Input value={form.pageSlug} onChange={(e) => setForm(f => ({ ...f, pageSlug: e.target.value }))} placeholder="about, contact, products" />
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
              <span className="text-sm">Идэвхтэй</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.openInNew} onChange={(e) => setForm(f => ({ ...f, openInNew: e.target.checked }))} />
              <span className="text-sm">Шинэ цонхонд нээх</span>
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

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMenuItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'menu'],
    queryFn: () => adminApi.menu.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.menu.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'menu'] }); toast.success('Устгагдлаа'); setDeleteTarget(null); },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.menu.reorder(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'menu'] }),
  });

  const move = (index: number, dir: -1 | 1) => {
    if (!data) return;
    const ids = data.map(m => m.id);
    const newIds = [...ids];
    const target = index + dir;
    if (target < 0 || target >= newIds.length) return;
    [newIds[index], newIds[target]] = [newIds[target], newIds[index]];
    reorderMutation.mutate(newIds);
  };

  if (isLoading) return <Loading label="Навигац ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Навигацийн цэс</h1>
          <p className="text-muted-foreground">Сайтын үндсэн цэсийг удирдах</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Цэс нэмэх
        </Button>
      </div>

      {!data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Navigation className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Цэс байхгүй байна</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Анхны цэс нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.map((item, i) => (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === data.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.label}</span>
                      <Badge variant={item.active ? 'default' : 'secondary'} className="text-xs">
                        {item.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </Badge>
                      {item.openInNew && <Badge variant="outline" className="text-xs">Шинэ цонх</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.pageSlug ? `/${item.pageSlug}` : (item.url ?? '—')}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(item); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-red-50 dark:bg-red-950/40"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Цэс устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">{deleteTarget.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{deleteTarget.pageSlug ? `/${deleteTarget.pageSlug}` : (deleteTarget.url ?? '—')}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Цэсийг бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MenuItemDialog
        open={dialogOpen}
        item={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['admin', 'menu'] });
        }}
      />
    </div>
  );
}
