'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Upload, X, Monitor, Smartphone, Video } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import type { AdminBanner } from '@/types/admin';

interface Props {
  open: boolean;
  banner: AdminBanner | null;
  onClose: () => void;
  onSaved: () => void;
}

const empty = {
  title: '',
  subtitle: '',
  imageUrl: '',
  mobileImageUrl: '',
  desktopImageUrl: '',
  videoUrl: '',
  posterUrl: '',
  linkUrl: '',
  linkLabel: 'Дэлгэрэнгүй',
  sortOrder: 0,
  bgColor: '',
  startsAt: '',
  endsAt: '',
  active: true,
};

type UploadField = 'imageUrl' | 'mobileImageUrl' | 'desktopImageUrl' | 'videoUrl';

export function BannerFormDialog({ open, banner, onClose, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState<UploadField | null>(null);

  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (banner) {
      setForm({
        title: banner.title,
        subtitle: banner.subtitle ?? '',
        imageUrl: banner.imageUrl,
        mobileImageUrl: banner.mobileImageUrl ?? '',
        desktopImageUrl: banner.desktopImageUrl ?? '',
        videoUrl: banner.videoUrl ?? '',
        posterUrl: banner.posterUrl ?? '',
        linkUrl: banner.linkUrl ?? '',
        linkLabel: banner.linkLabel ?? 'Дэлгэрэнгүй',
        sortOrder: banner.sortOrder,
        bgColor: banner.bgColor ?? '',
        startsAt: banner.startsAt ? banner.startsAt.slice(0, 16) : '',
        endsAt: banner.endsAt ? banner.endsAt.slice(0, 16) : '',
        active: banner.active,
      });
    } else {
      setForm(empty);
    }
  }, [banner, open]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        subtitle: form.subtitle || undefined,
        imageUrl: form.imageUrl || form.desktopImageUrl || form.mobileImageUrl || '',
        mobileImageUrl: form.mobileImageUrl || undefined,
        desktopImageUrl: form.desktopImageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        posterUrl: form.posterUrl || undefined,
        linkUrl: form.linkUrl || undefined,
        linkLabel: form.linkLabel || undefined,
        sortOrder: form.sortOrder,
        bgColor: form.bgColor || undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        active: form.active,
      };
      return banner
        ? adminApi.banners.update(banner.id, payload)
        : adminApi.banners.create(payload);
    },
    onSuccess: () => {
      toast.success(banner ? 'Баннер засагдлаа' : 'Баннер нэмэгдлээ');
      onSaved();
    },
    onError: () => toast.error('Хадгалахад алдаа гарлаа'),
  });

  const handleUpload = async (file: File, field: UploadField) => {
    setUploading(field);
    try {
      const result = await uploadWithProgress(file);
      setForm((f) => ({
        ...f,
        [field]: result.url,
        // Видео upload үед backend эхний frame (thumbnail) үүсгэдэг — түүнийг poster
        // болгож хадгална. Видео ачаалах хүртэл ИЖИЛ зураг харагдана → flash байхгүй.
        ...(field === 'videoUrl' && result.thumbnailUrl ? { posterUrl: result.thumbnailUrl } : {}),
      }));
    } catch {
      toast.error('Файл байршуулахад алдаа');
    } finally {
      setUploading(null);
    }
  };

  const hasAnyMedia = form.imageUrl || form.mobileImageUrl || form.desktopImageUrl || form.videoUrl;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{banner ? 'Баннер засах' : 'Баннер нэмэх'}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title) {
              toast.error('Гарчиг заавал шаардлагатай');
              return;
            }
            if (!hasAnyMedia) {
              toast.error('Дор хаяж нэг медиа файл байршуулна уу');
              return;
            }
            mutation.mutate();
          }}
        >
          {/* Media uploads — 3 zones */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Медиа файлууд</Label>

            {/* Desktop image */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Monitor className="h-3.5 w-3.5" />
                <span>Десктоп зураг (16:9 өргөн, 1920×1080+)</span>
              </div>
              {form.desktopImageUrl ? (
                <div className="relative h-32 w-full overflow-hidden rounded-lg border bg-muted">
                  <Image src={form.desktopImageUrl} alt="desktop" fill className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, desktopImageUrl: '' }))}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => desktopRef.current?.click()}
                >
                  <Monitor className="h-7 w-7 text-muted-foreground mb-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {uploading === 'desktopImageUrl' ? 'Байршуулж байна...' : 'Десктоп зураг сонгох'}
                  </p>
                  <input
                    ref={desktopRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f, 'desktopImageUrl');
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Mobile image */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Мобайл зураг (9:16 босоо, 1080×1920)</span>
              </div>
              {form.mobileImageUrl ? (
                <div className="relative mx-auto h-48 w-28 overflow-hidden rounded-lg border bg-muted">
                  <Image src={form.mobileImageUrl} alt="mobile" fill className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mobileImageUrl: '' }))}
                    className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => mobileRef.current?.click()}
                >
                  <Smartphone className="h-7 w-7 text-muted-foreground mb-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {uploading === 'mobileImageUrl' ? 'Байршуулж байна...' : 'Мобайл зураг сонгох (9:16)'}
                  </p>
                  <input
                    ref={mobileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f, 'mobileImageUrl');
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Video — ⚠️ видеог ЭНД оруулна (дээрх зургийн хэсэгт БИШ) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Video className="h-3.5 w-3.5" />
                <span>🎬 Видео энд оруулна (MP4, WebM — autoplay, loop)</span>
              </div>
              {form.videoUrl ? (
                <div className="relative overflow-hidden rounded-lg border bg-muted">
                  <video
                    src={form.videoUrl}
                    className="h-32 w-full object-cover"
                    muted
                    playsInline
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, videoUrl: '', posterUrl: '' }))}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    Видео
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-colors"
                  onClick={() => videoRef.current?.click()}
                >
                  <Video className="h-7 w-7 text-primary mb-1.5" />
                  <p className="text-xs font-medium text-primary">
                    {uploading === 'videoUrl' ? 'Байршуулж байна...' : 'Видео сонгох (MP4, WebM)'}
                  </p>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/mp4,video/webm,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f, 'videoUrl');
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Legacy imageUrl fallback */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                <span>Нөөц зураг (хуучин / fallback)</span>
              </div>
              {form.imageUrl ? (
                <div className="relative h-24 w-full overflow-hidden rounded-lg border bg-muted">
                  <Image src={form.imageUrl} alt="fallback" fill className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    const inp = document.createElement('input');
                    inp.type = 'file';
                    inp.accept = 'image/*';
                    inp.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleUpload(f, 'imageUrl');
                    };
                    inp.click();
                  }}
                >
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {uploading === 'imageUrl' ? 'Байршуулж байна...' : 'Fallback зураг сонгох'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Гарчиг *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="DigitalGer Premium Bundle"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Дэд гарчиг</Label>
            <Input
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              placeholder="Хязгаарлагдмал хугацааны санал"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Холбоос URL</Label>
              <Input
                value={form.linkUrl}
                onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                placeholder="/products/bundle"
              />
            </div>
            <div className="space-y-2">
              <Label>Товчны текст</Label>
              <Input
                value={form.linkLabel}
                onChange={(e) => setForm((f) => ({ ...f, linkLabel: e.target.value }))}
                placeholder="Дэлгэрэнгүй"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Дэвсгэр өнгө (HEX)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.bgColor || '#022179'}
                  onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                  className="h-10 w-12 cursor-pointer rounded border border-input"
                />
                <Input
                  value={form.bgColor}
                  onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                  placeholder="#022179"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Дараалал</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                min={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Эхлэх огноо</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Дуусах огноо</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="rounded border-input"
            />
            <span className="text-sm font-medium">Идэвхтэй харуулах</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Болих
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading !== null}>
              {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
