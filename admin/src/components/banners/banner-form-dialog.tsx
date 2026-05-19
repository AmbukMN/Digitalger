'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
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
  linkUrl: '',
  linkLabel: 'Дэлгэрэнгүй',
  sortOrder: 0,
  bgColor: '',
  startsAt: '',
  endsAt: '',
  active: true,
};

export function BannerFormDialog({ open, banner, onClose, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (banner) {
      setForm({
        title: banner.title,
        subtitle: banner.subtitle ?? '',
        imageUrl: banner.imageUrl,
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
        imageUrl: form.imageUrl,
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

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await adminApi.upload(file);
      setForm((f) => ({ ...f, imageUrl: result.url }));
    } catch {
      toast.error('Зураг байршуулахад алдаа');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{banner ? 'Баннер засах' : 'Баннер нэмэх'}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title || !form.imageUrl) {
              toast.error('Гарчиг болон зураг заавал шаардлагатай');
              return;
            }
            mutation.mutate();
          }}
        >
          {/* Image */}
          <div className="space-y-2">
            <Label>Баннерийн зураг *</Label>
            {form.imageUrl ? (
              <div className="relative h-36 w-full overflow-hidden rounded-lg border bg-muted">
                <Image src={form.imageUrl} alt="banner" fill className="object-cover" unoptimized />
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
                className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {uploading ? 'Байршуулж байна...' : 'Зураг сонгох'}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </div>
            )}
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
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
