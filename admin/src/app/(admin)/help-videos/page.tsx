'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Video, Upload, Loader2, Play, GripVertical, Eye, Search,
} from 'lucide-react';
import {
  Badge, Button, Card, CardContent, Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, ErrorState, Input, Label, Loading, StatCard, StatsGrid,
} from '@digitalger/shared/ui';
import { adminApi, errMsg } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import { useCurrentAdmin } from '@/hooks/use-current-admin';
import type { AdminHelpVideo } from '@/types/admin';

const emptyForm = {
  title: '', description: '', videoUrl: '', videoKey: '', posterKey: '',
  durationLabel: '', sortOrder: 0, active: true,
  // Product detail хуудсанд аль дэлгэцэд (desktop/mobile). Help самбарт бүгд гарна.
  platform: 'desktop',
  // Видео файл upload → rawVideoKey (R2 түр key). Backend HLS-руу хөрвүүлнэ.
  rawVideoKey: '',
};
type FormState = typeof emptyForm;

// ── Form Dialog (нэмэх/засах) ────────────────────────────────────────────
function HelpVideoDialog({
  open, video, onClose, onSaved,
}: { open: boolean; video: AdminHelpVideo | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState<'video' | 'poster' | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(video
        ? {
            title: video.title,
            description: video.description ?? '',
            videoUrl: video.videoUrl ?? '',
            videoKey: video.videoKey ?? '',
            posterKey: video.posterKey ?? '',
            durationLabel: video.durationLabel ?? '',
            platform: video.platform === 'mobile' ? 'mobile' : 'desktop',
            sortOrder: video.sortOrder,
            active: video.active,
            rawVideoKey: '',
          }
        : emptyForm
      );
    }
  }, [open, video?.id]);

  // Видео файлын хугацааг client дээр унших (upload-аас өмнө) → "1:23" формат
  const readDuration = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      try {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(v.src);
          const sec = Math.round(v.duration);
          if (!sec || !isFinite(sec)) return resolve(null);
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          resolve(`${m}:${String(s).padStart(2, '0')}`);
        };
        v.onerror = () => resolve(null);
        v.src = URL.createObjectURL(file);
      } catch { resolve(null); }
    });

  const handleUpload = async (file: File, field: 'video' | 'poster') => {
    setUploading(field);
    try {
      // Видео бол хугацааг ЗЭРЭГ уншина (upload-той зэрэгцүүлэн)
      const durPromise = field === 'video' ? readDuration(file) : Promise.resolve(null);
      // Видео бол R2 tmp-д raw upload (folder=tmp) → rawVideoKey (backend HLS болгоно).
      const folder = field === 'video' ? 'tmp' : 'help-videos';
      const [res, dur] = await Promise.all([uploadWithProgress(file, folder), durPromise]);
      if (field === 'video') {
        // ⚠️ Чанар БУУРУУЛАХГҮЙ — raw файлыг R2-д тавиад backend -c copy HLS болгоно.
        // rawVideoKey = R2 key (worker татаж хөрвүүлнэ). videoKey хоосон (worker бичнэ).
        setForm((f) => ({ ...f, rawVideoKey: res.key, videoKey: '', videoUrl: '', durationLabel: dur || f.durationLabel }));
      } else {
        setForm((f) => ({ ...f, posterKey: res.url }));
      }
      toast.success(field === 'video' && dur ? `Байршуулсан (${dur}) · HLS болгож байна` : 'Байршуулсан');
    } catch (e) {
      toast.error(errMsg(e, 'Байршуулахад алдаа'));
    } finally {
      setUploading(null);
    }
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Partial<AdminHelpVideo> & { rawVideoKey?: string } = {
        title: form.title,
        description: form.description || undefined,
        videoUrl: form.videoUrl || undefined,
        videoKey: form.videoKey || undefined,
        posterKey: form.posterKey || undefined,
        durationLabel: form.durationLabel || undefined,
        platform: form.platform,
        sortOrder: form.sortOrder,
        active: form.active,
        // Шинэ видео upload → backend HLS-руу queue (зөвхөн create үед).
        rawVideoKey: form.rawVideoKey || undefined,
      };
      return video
        ? adminApi.helpVideos.update(video.id, payload)
        : adminApi.helpVideos.create(payload);
    },
    onSuccess: () => { toast.success('Хадгалагдлаа'); onSaved(); },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  const hasVideo = !!(form.videoKey || form.rawVideoKey);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Видео заавар засах' : 'Видео заавар нэмэх'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!hasVideo) { toast.error('Видео файл байршуулна уу'); return; } mutation.mutate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Гарчиг *</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Жишээ: Бүтээгдэхүүн хэрхэн авах вэ?" required />
            </div>
            <div className="space-y-2">
              <Label>Үргэлжлэх хугацаа</Label>
              <Input value={form.durationLabel} onChange={(e) => setForm(f => ({ ...f, durationLabel: e.target.value }))} placeholder="Авто (видеоноос)" />
            </div>
            <div className="space-y-2">
              <Label>Дараалал</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} min={0} />
            </div>
            {/* Product detail хуудсанд аль дэлгэцэд харуулах (бүх видео help
                самбарт үргэлж гарна — энэ нь зөвхөн бүтээгдэхүүний хуудсанд). */}
            <div className="space-y-2 col-span-2">
              <Label>Бүтээгдэхүүний хуудсанд аль дэлгэцэд</Label>
              <select
                value={form.platform === 'mobile' ? 'mobile' : 'desktop'}
                onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="desktop">Desktop (компьютер) дээр харуулах</option>
                <option value="mobile">Mobile (гар утас) дээр харуулах</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Бүх видео Туслах самбарт үргэлж харагдана. Энэ сонголт нь бүтээгдэхүүний
                хуудсанд (сургалтаас бусад) аль дэлгэцэд харуулахыг заана.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Тайлбар</Label>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Богино тайлбар (заавал биш)"
            />
          </div>

          {/* Видео эх сурвалж — файл upload (R2) */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Видео эх сурвалж</Label>

            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'video'); e.target.value = ''; }} />

            {form.videoKey ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-sm">
                <span className="flex items-center gap-2 truncate"><Video className="h-4 w-4 text-primary shrink-0" /> Видео байршуулсан</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setForm(f => ({ ...f, videoKey: '' }))}>Устгах</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" disabled={uploading === 'video'} onClick={() => videoInputRef.current?.click()}>
                {uploading === 'video' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Видео файл байршуулах (MP4/WebM)
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">Видео байршуулахад үргэлжлэх хугацаа автоматаар тооцогдоно.</p>
          </div>

          {/* Thumbnail (poster) — заавал биш */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Зураг (thumbnail, заавал биш)</Label>
            <input ref={posterInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'poster'); e.target.value = ''; }} />
            {form.posterKey ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.posterKey} alt="poster" className="h-14 w-24 rounded object-cover ring-1 ring-border" />
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm(f => ({ ...f, posterKey: '' }))}>Устгах</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled={uploading === 'poster'} onClick={() => posterInputRef.current?.click()}>
                {uploading === 'poster' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Зураг байршуулах
              </Button>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
            <span className="text-sm">Идэвхтэй (туслах самбарт харагдана)</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Болих</Button>
            <Button type="submit" disabled={mutation.isPending || !!uploading}>{mutation.isPending ? 'Хадгалж...' : 'Хадгалах'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HelpVideosPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminHelpVideo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminHelpVideo | null>(null);
  const [search, setSearch] = useState('');
  const { canModify } = useCurrentAdmin();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'help-videos'],
    queryFn: () => adminApi.helpVideos.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    // HLS хөрвүүлж буй видео байвал 5с тутам polling (бэлэн болоход автомат шинэчлэх)
    refetchInterval: (q) =>
      (q.state.data ?? []).some((v) => v.streamStatus === 'processing') ? 5000 : false,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.helpVideos.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'help-videos'] }); toast.success('Устгагдлаа'); setDeleteTarget(null); },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа')),
  });

  if (isLoading) return <Loading label="Видео заавар ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  const all = data ?? [];
  // Хайлт — гарчиг/тайлбараар client-side (бага дата, бүгдийг нэг дор татна)
  const q = search.trim().toLowerCase();
  const items = q
    ? all.filter((v) => v.title.toLowerCase().includes(q) || (v.description ?? '').toLowerCase().includes(q))
    : all;
  // Статистик
  const total = all.length;
  const activeCount = all.filter((v) => v.active).length;
  const processingCount = all.filter((v) => v.streamStatus === 'processing').length;
  const totalViews = all.reduce((s, v) => s + (v._count?.views ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl tracking-tight">Видео заавар</h1>
          <p className="text-muted-foreground">Туслах самбар (Help)-ын &ldquo;Видео заавар&rdquo; таб-д харагдах зааврууд.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Видео нэмэх
        </Button>
      </div>

      {/* Статистик */}
      {total > 0 && (
        <StatsGrid>
          <StatCard label="Нийт" value={total} />
          <StatCard label="Идэвхтэй" value={activeCount} variant="success" />
          <StatCard label="HLS боловсруулж байна" value={processingCount} variant="warning" />
          <StatCard label="Нийт үзэлт" value={totalViews} variant="primary" />
        </StatsGrid>
      )}

      {/* Хайлт */}
      {total > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Гарчиг, тайлбараар хайх..." className="pl-9" />
        </div>
      )}

      {!all.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Видео заавар байхгүй байна</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Анхны видео нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Багануудын гарчиг (table header) */}
          <div className="flex items-center gap-3 px-3 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">
            <span className="w-4 shrink-0" />
            <span className="w-20 shrink-0">Зураг</span>
            <span className="flex-1">Гарчиг</span>
            <span className="w-20 shrink-0 text-center">Хугацаа</span>
            <span className="w-20 shrink-0 text-center">Төлөв</span>
            <span className="w-16 shrink-0 text-center">Үзэлт</span>
            <span className="w-16 shrink-0 text-center">Үйлдэл</span>
          </div>
          {items.map((v) => (
            <Card key={v.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-3">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                {/* Зураг column — poster, эс бол видеоны эхний frame */}
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-muted">
                  {v.posterKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.posterKey} alt={v.title} className="h-full w-full object-cover" />
                  ) : (v.videoKey || v.videoUrl) ? (
                    <video src={`${v.videoKey || v.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Play className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                </div>
                {/* Гарчиг column */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                  {v.description && <p className="truncate text-xs text-muted-foreground">{v.description}</p>}
                </div>
                {/* Хугацаа column */}
                <span className="w-20 shrink-0 text-center text-xs text-muted-foreground">{v.durationLabel || '—'}</span>
                {/* Төлөв column */}
                <span className="flex w-20 shrink-0 justify-center">
                  {v.streamStatus === 'processing' ? (
                    <Badge className="bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-900/30">⏳ HLS</Badge>
                  ) : v.streamStatus === 'error' ? (
                    <Badge variant="destructive" className="text-[10px]">Алдаа</Badge>
                  ) : (
                    <Badge variant={v.active ? 'default' : 'secondary'} className="text-[10px]">{v.active ? 'Идэвхтэй' : 'Идэвхгүй'}</Badge>
                  )}
                </span>
                {/* Үзэлт column (тусдаа) */}
                <span className="flex w-16 shrink-0 items-center justify-center gap-1 text-sm font-semibold text-foreground" title="Хэдэн удаа үзсэн">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" /> {v._count?.views ?? 0}
                </span>
                {/* Үйлдэл column */}
                {canModify(v) ? (
                  <div className="flex w-16 shrink-0 justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(v); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => setDeleteTarget(v)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span className="w-16 shrink-0 text-center text-[10px] italic text-muted-foreground/70">Өөр админ</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Видео заавар устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && <div className="rounded-lg bg-muted/50 p-3"><p className="text-sm font-medium line-clamp-2">{deleteTarget.title}</p></div>}
          <p className="text-sm text-muted-foreground">Бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpVideoDialog
        open={dialogOpen}
        video={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ['admin', 'help-videos'] }); }}
      />
    </div>
  );
}
