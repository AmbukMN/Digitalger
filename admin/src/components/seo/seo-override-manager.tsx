'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { LayoutTemplate, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import type { SeoOverride } from '@/types/admin';

// Хүн уншихад ойлгомжтой нэр (зөвхөн харуулахад)
const PATH_LABELS: Record<string, string> = {
  '/': 'Нүүр хуудас',
  '/products': 'Бүтээгдэхүүн',
  '/categories': 'Ангилал',
  '/blog': 'Нийтлэл',
  '/search': 'Хайлт',
};

function pathLabel(path: string) {
  return PATH_LABELS[path] ? `${PATH_LABELS[path]} (${path})` : path;
}

type FormState = {
  id?: string;
  path: string;
  title: string;
  description: string;
  ogImageUrl: string;
};

const EMPTY_FORM: FormState = { path: '', title: '', description: '', ogImageUrl: '' };

export function SeoOverrideManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [ogUploading, setOgUploading] = useState(false);

  const {
    data: overrides,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'seo', 'overrides'],
    queryFn: () => adminApi.seo.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: allowedPaths } = useQuery({
    queryKey: ['admin', 'seo', 'allowed-paths'],
    queryFn: () => adminApi.seo.allowedPaths(),
    staleTime: 60_000,
  });

  // Засаж буй хуудас (id байгаа) бол түүний path-г сонголтод үлдээх,
  // эс бөгөөс аль хэдийн override үүсгэсэн хуудсуудыг dropdown-оос хасна
  const usedPaths = useMemo(
    () => new Set((overrides ?? []).map((o) => o.path)),
    [overrides],
  );
  const selectablePaths = useMemo(() => {
    const all = allowedPaths ?? [];
    return all.filter((p) => p === form.path || !usedPaths.has(p));
  }, [allowedPaths, usedPaths, form.path]);

  const upsertMutation = useMutation({
    mutationFn: () =>
      adminApi.seo.upsert({
        id: form.id,
        path: form.path,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        ogImageUrl: form.ogImageUrl.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'seo', 'overrides'] });
      toast.success(form.id ? 'Override шинэчлэгдлээ' : 'Override нэмэгдлээ');
      setDialogOpen(false);
    },
    onError: () => toast.error('Хадгалахад алдаа гарлаа'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => adminApi.seo.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'seo', 'overrides'] });
      toast.success('Устгагдлаа — тухайн хуудас анхдагч meta-руу буцлаа');
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(o: SeoOverride) {
    setForm({
      id: o.id,
      path: o.path,
      title: o.title ?? '',
      description: o.description ?? '',
      ogImageUrl: o.ogImageUrl ?? '',
    });
    setDialogOpen(true);
  }

  function handleRemove(o: SeoOverride) {
    if (!window.confirm(`"${pathLabel(o.path)}" хуудасны override-ийг устгах уу? Тухайн хуудас өөрийн анхдагч meta-руу буцна.`)) {
      return;
    }
    removeMutation.mutate(o.id);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <LayoutTemplate className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Хуудасны Custom OG meta</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Зөвхөн жагсаалтын тогтмол хуудсуудад. Устгавал тухайн хуудас өөрийн анхдагч meta-руу буцна.
              </CardDescription>
            </div>
          </div>
          <Button type="button" size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Нэмэх
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Ачааллаж байна...</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-6 text-center">Ачаалахад алдаа гарлаа</p>
        ) : !overrides || overrides.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <LayoutTemplate className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Override байхгүй байна</p>
            <p className="text-xs text-muted-foreground/70">
              Хуудас бүр default meta-гаа ашиглаж байна. Override нэмбэл түүнийг дарж бичнэ.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {overrides.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {o.ogImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.ogImageUrl} alt="OG" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                      <LayoutTemplate className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{pathLabel(o.path)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {o.title || <span className="italic text-muted-foreground/60">title дарж бичээгүй</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(o)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Нэмэх / Засах dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Override засах' : 'Override нэмэх'}</DialogTitle>
            <DialogDescription>
              Зөвхөн жагсаалтын хуудас сонгоно. Устгавал тухайн хуудас өөрийн анхдагч meta-руу буцна.
            </DialogDescription>
          </DialogHeader>

          <form
            id="seo-override-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.path) {
                toast.error('Хуудас сонгоно уу');
                return;
              }
              upsertMutation.mutate();
            }}
          >
            {/* Path — DROPDOWN (гараар бичихгүй) */}
            <div className="space-y-1.5">
              <Label htmlFor="seo-path">Хуудас</Label>
              {form.id ? (
                <Input id="seo-path" value={pathLabel(form.path)} disabled />
              ) : (
                <Select value={form.path} onValueChange={(v) => setForm((p) => ({ ...p, path: v }))}>
                  <SelectTrigger id="seo-path">
                    <SelectValue placeholder="Хуудас сонгох..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectablePaths.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Бүх хуудас аль хэдийн override-тэй</div>
                    ) : (
                      selectablePaths.map((p) => (
                        <SelectItem key={p} value={p}>
                          {pathLabel(p)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">
                Зөвхөн бодит жагсаалтын хуудас (404 болохгүй).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo-title">Title</Label>
              <Input
                id="seo-title"
                placeholder="Хоосон бол анхдагч title хэвээр"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo-desc">Description</Label>
              <textarea
                id="seo-desc"
                rows={3}
                placeholder="Хоосон бол анхдагч description хэвээр"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="flex min-h-15 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* OG image upload */}
            <div className="space-y-1.5">
              <Label>OG зураг</Label>
              {form.ogImageUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.ogImageUrl} alt="OG preview" className="max-h-44 w-full object-cover" referrerPolicy="no-referrer" />
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, ogImageUrl: '' }))}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 h-32 w-full rounded-lg border-2 border-dashed border-border cursor-pointer transition-colors',
                    ogUploading ? 'opacity-60 cursor-wait' : 'hover:border-primary/50 hover:bg-muted/30',
                  )}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={ogUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setOgUploading(true);
                      try {
                        const result = await uploadWithProgress(file);
                        setForm((p) => ({ ...p, ogImageUrl: result.url }));
                      } catch {
                        toast.error('Зураг upload хийхэд алдаа гарлаа');
                      } finally {
                        setOgUploading(false);
                      }
                    }}
                  />
                  {ogUploading ? (
                    <span className="text-sm text-muted-foreground">Байршуулж байна...</span>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Зургаа энд дарж upload хийнэ</span>
                      <span className="text-xs text-muted-foreground/60">PNG, JPG, WEBP · зөвлөмж 1200×630px</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Болих
            </Button>
            <Button
              type="submit"
              form="seo-override-form"
              disabled={upsertMutation.isPending || ogUploading || !form.path}
            >
              {upsertMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
