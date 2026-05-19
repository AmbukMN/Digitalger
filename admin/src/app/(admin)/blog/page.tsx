'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, FileText, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
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
  Input,
  Label,
  Loading,
  ErrorState,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { RichEditor } from '@/components/ui/rich-editor';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  published: boolean;
  publishedAt?: string | null;
  tags: string[];
  authorName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/--+/g, '-');
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' });
}

const emptyForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  published: false,
  authorName: 'DigitalGer',
  tagsInput: '',
  sortOrder: 0,
};

function BlogDialog({
  open,
  post,
  onClose,
  onSaved,
}: {
  open: boolean;
  post: BlogPost | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (post) {
        setForm({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? '',
          content: post.content,
          coverImageUrl: post.coverImageUrl ?? '',
          published: post.published,
          authorName: post.authorName,
          tagsInput: post.tags.join(', '),
          sortOrder: post.sortOrder,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [post, open]);

  const set = (key: keyof typeof form, value: string | boolean | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: post ? f.slug : slugify(title),
    }));
  };

  const mutation = useMutation({
    mutationFn: () => {
      const tags = form.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const body = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt || undefined,
        content: form.content,
        coverImageUrl: form.coverImageUrl || undefined,
        published: form.published,
        authorName: form.authorName || 'DigitalGer',
        tags,
        sortOrder: form.sortOrder,
      };
      return post
        ? adminApi.blog.update(post.id, body)
        : adminApi.blog.create(body);
    },
    onSuccess: () => {
      toast.success(post ? 'Нийтлэл шинэчлэгдлээ' : 'Нийтлэл нэмэгдлээ');
      onSaved();
    },
    onError: (err: Error) => {
      const msg = err.message?.includes('slug') ? 'Slug давхардаж байна' : 'Алдаа гарлаа';
      toast.error(msg);
    },
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await adminApi.upload(file);
      set('coverImageUrl', result.url);
      toast.success('Зураг ачаалагдлаа');
    } catch {
      toast.error('Зураг ачаалахад алдаа гарлаа');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? 'Нийтлэл засах' : 'Шинэ нийтлэл'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cover image */}
          <div className="space-y-2">
            <Label>Нүүр зураг</Label>
            <div
              className="relative flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted transition-colors hover:border-primary/50"
              onClick={() => fileRef.current?.click()}
            >
              {form.coverImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.coverImageUrl} alt="Cover" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive hover:bg-background"
                    onClick={(e) => { e.stopPropagation(); set('coverImageUrl', ''); }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">{uploading ? 'Ачаалж байна...' : 'Зураг оруулах'}</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            {form.coverImageUrl && (
              <Input
                value={form.coverImageUrl}
                onChange={(e) => set('coverImageUrl', e.target.value)}
                placeholder="Эсвэл URL оруулах"
                className="text-xs"
              />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Гарчиг *</Label>
              <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Нийтлэлийн гарчиг" />
            </div>
            <div className="space-y-2">
              <Label>URL slug *</Label>
              <Input value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="url-slug" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Хураангуй</Label>
            <textarea
              className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
              placeholder="Нийтлэлийн богино тайлбар"
            />
          </div>

          <div className="space-y-2">
            <Label>Агуулга *</Label>
            <RichEditor
              value={form.content}
              onChange={(v) => set('content', v)}
              placeholder="Нийтлэлийн бүрэн агуулга..."
              minHeight="200px"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Тагууд (таслалаар тусгаарлах)</Label>
              <Input value={form.tagsInput} onChange={(e) => set('tagsInput', e.target.value)} placeholder="Загвар, Дижитал, Курс" />
            </div>
            <div className="space-y-2">
              <Label>Зохиогч</Label>
              <Input value={form.authorName} onChange={(e) => set('authorName', e.target.value)} placeholder="DigitalGer" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Дараалал</Label>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={form.published}
                  onChange={(e) => set('published', e.target.checked)}
                />
                <span>Нийтлэх</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Цуцлах</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.title || !form.slug || !form.content}>
            {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BlogPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'blog'],
    queryFn: () => adminApi.blog.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.blog.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      toast.success('Нийтлэл устгагдлаа');
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  if (isLoading) return <Loading label="Нийтлэлүүд ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  const posts: BlogPost[] = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Нийтлэл</h1>
          <p className="text-muted-foreground">Blog нийтлэлүүдийг удирдах</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Нийтлэл нэмэх
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нийтлэл байхгүй байна</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Анхны нийтлэл нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <div key={post.id} className="flex items-start gap-4 p-4">
                  {/* Cover image thumbnail */}
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{post.title}</p>
                      <Badge variant={post.published ? 'default' : 'secondary'} className="text-xs">
                        {post.published ? 'Нийтлэгдсэн' : 'Ноорог'}
                      </Badge>
                    </div>
                    {post.excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(post.publishedAt ?? post.createdAt)}
                      </span>
                      {post.tags.length > 0 && (
                        <span>{post.tags.slice(0, 3).join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditing(post); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Нийтлэл устгах уу?')) deleteMut.mutate(post.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <BlogDialog
        open={dialogOpen}
        post={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
        }}
      />
    </div>
  );
}
