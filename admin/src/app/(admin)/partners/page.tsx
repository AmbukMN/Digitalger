'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Handshake, Upload, X, Search, ExternalLink } from 'lucide-react';
import Image from 'next/image';
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
import { uploadWithProgress } from '@/lib/upload-with-progress';
import { useCurrentAdmin } from '@/hooks/use-current-admin';
import type { AdminPartner } from '@/types/admin';

const empty = { name: '', logo: '', description: '', website: '', featured: true, active: true, sortOrder: 0 };

function PartnerDialog({
  open, item, onClose, onSaved,
}: { open: boolean; item: AdminPartner | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && item) {
      setForm({
        name: item.name, logo: item.logo ?? '', description: item.description ?? '',
        website: item.website ?? '', featured: item.featured, active: item.active, sortOrder: item.sortOrder,
      });
    } else if (open) {
      setForm(empty);
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, logo: form.logo || undefined, description: form.description || undefined,
        website: form.website || undefined, featured: form.featured, active: form.active, sortOrder: form.sortOrder,
      };
      return item ? adminApi.partners.update(item.id, payload) : adminApi.partners.create(payload);
    },
    onSuccess: () => { toast.success('Хадгалагдлаа'); onSaved(); },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadWithProgress(file);
      setForm(f => ({ ...f, logo: result.url }));
    } catch { toast.error('Зураг байршуулахад алдаа'); }
    finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Хамтрагч засах' : 'Хамтрагч нэмэх'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          {/* Logo */}
          <div className="space-y-2">
            <Label>Лого зураг</Label>
            <div className="flex items-center gap-3">
              {form.logo ? (
                <div className="relative h-16 w-16 shrink-0">
                  <Image src={form.logo} alt="logo" fill className="rounded-lg border border-border object-contain p-1" unoptimized />
                  <button type="button" onClick={() => setForm(f => ({ ...f, logo: '' }))} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 shrink-0">
                  {uploading ? <span className="text-[10px] text-muted-foreground">Хуулж...</span> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
              )}
              <Input value={form.logo} onChange={(e) => setForm(f => ({ ...f, logo: e.target.value }))} placeholder="Эсвэл зурагны URL" className="text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Нэр *</Label>
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Компанийн нэр" required />
          </div>

          <div className="space-y-2">
            <Label>Тайлбар</Label>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Хамтрагчийн тухай товч (опцион)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Вэб хаяг</Label>
              <Input value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Дараалал</Label>
              <Input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm(f => ({ ...f, featured: e.target.checked }))} />
              <span className="text-sm">Онцлох</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
              <span className="text-sm">Идэвхтэй</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Болих</Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>{mutation.isPending ? 'Хадгалж...' : 'Хадгалах'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPartner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPartner | null>(null);
  const [search, setSearch] = useState('');
  const { canModify } = useCurrentAdmin();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: () => adminApi.partners.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.partners.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] }); toast.success('Устгагдлаа'); setDeleteTarget(null); },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа')),
  });

  if (isLoading) return <Loading label="Хамтрагч ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  const all = data ?? [];
  // Статистик
  const total = all.length;
  const activeCount = all.filter((p) => p.active).length;
  const featuredCount = all.filter((p) => p.featured).length;
  const withLogo = all.filter((p) => !!p.logo).length;
  // Хайлт (нэр/тайлбар)
  const q = search.trim().toLowerCase();
  const items = q
    ? all.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
    : all;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl tracking-tight">Хамтрагчид (Partners)</h1>
          <p className="text-muted-foreground">Нийтлэлийн footer дээд талд цувран харагдах хамтрагч байгууллагууд.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Хамтрагч нэмэх
        </Button>
      </div>

      {/* Статистик */}
      {total > 0 && (
        <StatsGrid>
          <StatCard label="Нийт" value={total} />
          <StatCard label="Идэвхтэй" value={activeCount} variant="success" />
          <StatCard label="Онцлох" value={featuredCount} variant="primary" />
          <StatCard label="Логотой" value={withLogo} sub={`/${total}`} />
        </StatsGrid>
      )}

      {/* Хайлт */}
      {total > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Нэр, тайлбараар хайх..." className="pl-9" />
        </div>
      )}

      {!all.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Handshake className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Хамтрагч байхгүй байна</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Анхны хамтрагч нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {p.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo} alt={p.name} className="h-full w-full object-contain p-1" referrerPolicy="no-referrer" />
                    ) : (
                      <Handshake className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {p.website && (
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" /> {p.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  <Badge variant={p.active ? 'default' : 'secondary'} className="text-xs shrink-0">{p.active ? 'Идэвхтэй' : 'Идэвхгүй'}</Badge>
                </div>

                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}

                {p.featured && <Badge variant="outline" className="text-xs">Онцлох</Badge>}

                {/* Зөвхөн өөрийн (эсвэл SUPERADMIN) контентод edit/delete */}
                {canModify(p) ? (
                  <div className="flex gap-1 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Засах
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive hover:bg-red-50 dark:bg-red-950/40"
                      onClick={() => setDeleteTarget(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="pt-1 text-[10px] italic text-muted-foreground/70" title="Өөр админы контент">
                    Өөр админы контент
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Хамтрагч устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {deleteTarget.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={deleteTarget.logo} alt={deleteTarget.name} className="h-full w-full object-contain p-1" referrerPolicy="no-referrer" />
                ) : <Handshake className="h-4 w-4 text-muted-foreground" />}
              </div>
              <p className="text-sm font-medium">{deleteTarget.name}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Хамтрагчийг бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartnerDialog
        open={dialogOpen}
        item={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] }); }}
      />
    </div>
  );
}
