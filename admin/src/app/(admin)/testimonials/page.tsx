'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MessageSquare, Star, Upload, X } from 'lucide-react';
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
} from '@digitalger/shared/ui';
import { adminApi, errMsg } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';

interface Testimonial {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  content: string;
  rating: number;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  _count?: { products: number };
}

const empty = { name: '', avatar: '', role: '', content: '', rating: 5, featured: true, active: true, sortOrder: 0 };

function TestimonialDialog({
  open, item, onClose, onSaved,
}: { open: boolean; item: Testimonial | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && item) {
      setForm({ name: item.name, avatar: item.avatar ?? '', role: item.role ?? '', content: item.content, rating: item.rating, featured: item.featured, active: item.active, sortOrder: item.sortOrder });
    } else if (open) {
      setForm(empty);
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, avatar: form.avatar || undefined, role: form.role || undefined,
        content: form.content, rating: form.rating, featured: form.featured, active: form.active, sortOrder: form.sortOrder,
      };
      return item ? adminApi.testimonials.update(item.id, payload) : adminApi.testimonials.create(payload);
    },
    onSuccess: () => { toast.success('Хадгалагдлаа'); onSaved(); },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadWithProgress(file);
      setForm(f => ({ ...f, avatar: result.url }));
    } catch { toast.error('Зураг байршуулахад алдаа'); }
    finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Сэтгэгдэл засах' : 'Сэтгэгдэл нэмэх'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          {/* Avatar */}
          <div className="space-y-2">
            <Label>Профайл зураг</Label>
            <div className="flex items-center gap-3">
              {form.avatar ? (
                <div className="relative h-16 w-16 shrink-0">
                  <Image src={form.avatar} alt="avatar" fill className="rounded-full object-cover" unoptimized />
                  <button type="button" onClick={() => setForm(f => ({ ...f, avatar: '' }))} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border hover:border-primary/50 shrink-0">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
              )}
              <Input value={form.avatar} onChange={(e) => setForm(f => ({ ...f, avatar: e.target.value }))} placeholder="Эсвэл зурагны URL" className="text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Нэр *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Бат-Эрдэнэ" required />
            </div>
            <div className="space-y-2">
              <Label>Дүр / Компани</Label>
              <Input value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Менежер @ XYZ" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Сэтгэгдэл *</Label>
            <textarea
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.content}
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Хэрэглэгчийн бодол санаа..."
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Үнэлгээ</Label>
              <Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm(f => ({ ...f, rating: parseInt(e.target.value) || 5 }))} />
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Болих</Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>{mutation.isPending ? 'Хадгалж...' : 'Хадгалах'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TestimonialsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'testimonials'],
    queryFn: () => adminApi.testimonials.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.testimonials.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] }); toast.success('Устгагдлаа'); setDeleteTarget(null); },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа')),
  });

  if (isLoading) return <Loading label="Сэтгэгдэл ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Гэрчилгээ / Сэтгэгдэл</h1>
          <p className="text-muted-foreground">Хэрэглэгчийн сэтгэгдлүүдийг удирдах</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Сэтгэгдэл нэмэх
        </Button>
      </div>

      {!data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Сэтгэгдэл байхгүй байна</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Анхны сэтгэгдэл нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {t.avatar ? (
                    <Image src={t.avatar} alt={t.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover shrink-0" unoptimized />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    {t.role && <p className="text-xs text-muted-foreground truncate">{t.role}</p>}
                  </div>
                  <div className="ml-auto flex gap-1">
                    <Badge variant={t.active ? 'default' : 'secondary'} className="text-xs">{t.active ? 'Идэвхтэй' : 'Идэвхгүй'}</Badge>
                  </div>
                </div>

                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-3.5 w-3.5 ${s <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                  ))}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3">{t.content}</p>

                {t._count?.products ? (
                  <Badge variant="outline" className="text-xs">{t._count.products} бүтээгдэхүүнд оноогдсон</Badge>
                ) : null}

                <div className="flex gap-1 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Засах
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Сэтгэгдэл устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              {deleteTarget.avatar ? (
                <Image src={deleteTarget.avatar} alt={deleteTarget.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover shrink-0" unoptimized />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {deleteTarget.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{deleteTarget.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{deleteTarget.content}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Сэтгэгдлийг бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TestimonialDialog
        open={dialogOpen}
        item={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] }); }}
      />
    </div>
  );
}
