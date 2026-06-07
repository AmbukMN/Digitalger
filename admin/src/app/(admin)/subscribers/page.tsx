'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Mail,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Download,
  FolderPlus,
  Search,
  X,
  Tag as TagIcon,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { TagInput } from '@/components/ui/tag-input';
import { SimpleDropdown, SimpleDropdownItem } from '@/components/ui/simple-dropdown';
import { Pagination } from '@/components/ui/pagination';
import type { AdminSubscriber, AdminSubscriberCategory } from '@/types/admin';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Идэвхтэй',
  INACTIVE: 'Идэвхгүй',
  UNSUBSCRIBED: 'Орхисон',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  INACTIVE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  UNSUBSCRIBED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const SEX_LABEL: Record<string, string> = { MALE: 'Эрэгтэй', FEMALE: 'Эмэгтэй', OTHER: 'Бусад' };

const emptyForm = {
  email: '',
  firstName: '',
  lastName: '',
  age: '',
  sex: '' as '' | 'MALE' | 'FEMALE' | 'OTHER',
  phone: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'UNSUBSCRIBED',
  categoryId: '',
  tags: [] as string[],
};

// ─── Add/Edit dialog ──────────────────────────────────────────────────────────
function SubscriberDialog({
  open,
  subscriber,
  categories,
  onClose,
}: {
  open: boolean;
  subscriber: AdminSubscriber | null;
  categories: AdminSubscriberCategory[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (subscriber) {
      setForm({
        email: subscriber.email,
        firstName: subscriber.firstName ?? '',
        lastName: subscriber.lastName ?? '',
        age: subscriber.age != null ? String(subscriber.age) : '',
        sex: subscriber.sex ?? '',
        phone: subscriber.phone ?? '',
        status: subscriber.status,
        categoryId: subscriber.categoryId ?? '',
        tags: subscriber.tags ?? [],
      });
    } else {
      setForm(emptyForm);
    }
  }, [subscriber, open]);

  const mut = useMutation({
    mutationFn: () => {
      const body: Partial<AdminSubscriber> = {
        email: form.email.trim(),
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        age: form.age ? Number(form.age) : null,
        sex: form.sex || null,
        phone: form.phone.trim() || null,
        status: form.status,
        categoryId: form.categoryId || null,
        tags: form.tags,
      };
      return subscriber
        ? adminApi.subscribers.update(subscriber.id, body)
        : adminApi.subscribers.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      toast.success(subscriber ? 'Шинэчлэгдлээ' : 'Нэмэгдлээ');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{subscriber ? 'Subscriber засах' : 'Subscriber нэмэх'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.email.includes('@')) return toast.error('Имэйл буруу байна');
            mut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Имэйл *</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Нэр</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Овог</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Нас</Label>
              <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Хүйс</Label>
              <Select value={form.sex || 'none'} onValueChange={(v) => setForm({ ...form, sex: v === 'none' ? '' : (v as 'MALE' | 'FEMALE' | 'OTHER') })}>
                <SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="MALE">Эрэгтэй</SelectItem>
                  <SelectItem value="FEMALE">Эмэгтэй</SelectItem>
                  <SelectItem value="OTHER">Бусад</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Утас</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Төлөв</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Идэвхтэй</SelectItem>
                  <SelectItem value="INACTIVE">Идэвхгүй</SelectItem>
                  <SelectItem value="UNSUBSCRIBED">Орхисон</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Категори</Label>
            <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput
              value={form.tags}
              onChange={(tags) => setForm({ ...form, tags })}
              placeholder="vip, идэвхтэй... (Enter дарна уу)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Болих</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? 'Хадгалж байна...' : 'Хадгалах'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category management dialog ───────────────────────────────────────────────
function CategoryDialog({
  open,
  categories,
  onClose,
}: {
  open: boolean;
  categories: AdminSubscriberCategory[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');

  const createMut = useMutation({
    mutationFn: () => adminApi.subscribers.categories.create({ name: newName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      setNewName('');
      toast.success('Категори нэмэгдлээ');
    },
    onError: (e: Error) => toast.error(e.message || 'Алдаа'),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => adminApi.subscribers.categories.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      toast.success('Устгагдлаа');
    },
    onError: (e: Error) => toast.error(e.message || 'Алдаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Категори удирдах</DialogTitle></DialogHeader>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMut.mutate(); }}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Шинэ категори нэр" />
          <Button type="submit" disabled={createMut.isPending || !newName.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <TagIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.count}</span>
              {c.isSystem ? (
                <Badge className="text-[10px]">Систем</Badge>
              ) : (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMut.mutate(c.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {categories.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Категори алга</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SubscribersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSubscriber | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminSubscriber | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin', 'subscriber-categories'],
    queryFn: () => adminApi.subscribers.categories.list(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'subscribers', { page, pageSize, debouncedSearch, status, categoryId, source }],
    queryFn: () =>
      adminApi.subscribers.list({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        source: source || undefined,
      }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Шүүлт/хуудас солиход сонголтыг цэвэрлэнэ (өөр хуудасны id үлдэхээс сэргийлэх)
  useEffect(() => { setSelectedIds(new Set()); }, [page, pageSize, debouncedSearch, status, categoryId, source]);

  const bulkDeleteMut = useMutation({
    mutationFn: () => adminApi.subscribers.bulkDelete([...selectedIds]),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      toast.success(`${res.deleted} захиалагч устгагдлаа`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  const bulkAssignMut = useMutation({
    mutationFn: (catId: string | null) => adminApi.subscribers.assignCategory([...selectedIds], catId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      toast.success(`${res.updated} захиалагчийн категори шинэчлэгдлээ`);
      setSelectedIds(new Set());
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.subscribers.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      toast.success('Устгагдлаа');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const importMut = useMutation({
    mutationFn: (file: File) => adminApi.subscribers.bulkImport(file, categoryId || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscribers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscriber-categories'] });
      toast.success(`${res.created} нэмэгдлээ, ${res.skipped} давхардсан, ${res.failed} алдаатай`);
    },
    onError: () => toast.error('Import алдаа'),
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  const sources = ['homepage', 'free-ppt', 'checkout', 'popup', 'web-register', 'admin', 'import'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Subscriber
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Имэйл захиалагчдыг удирдах ({total})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}>
            <FolderPlus className="mr-1.5 h-4 w-4" /> Категори
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }}
          />
          <Button variant="outline" disabled={importMut.isPending} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> {importMut.isPending ? 'Уншиж байна...' : 'Import'}
          </Button>
          <SimpleDropdown
            disabled={total === 0}
            trigger={
              <Button variant="outline" disabled={total === 0}>
                <Download className="mr-1.5 h-4 w-4" /> Export
                <ChevronDown className="ml-1.5 h-4 w-4 opacity-60" />
              </Button>
            }
          >
            {(close) => (
              <>
                <SimpleDropdownItem
                  onClick={() => {
                    window.open(adminApi.subscribers.exportUrl({ format: 'excel', status, categoryId, source }), '_blank');
                    close();
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel татах
                </SimpleDropdownItem>
                <SimpleDropdownItem
                  onClick={() => {
                    window.open(adminApi.subscribers.exportUrl({ format: 'pdf', status, categoryId, source }), '_blank');
                    close();
                  }}
                >
                  <FileText className="h-4 w-4 text-red-600" /> PDF (хэвлэх)
                </SimpleDropdownItem>
              </>
            )}
          </SimpleDropdown>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Нэмэх
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Имэйл, нэр, утас хайх..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Төлөв" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төлөв</SelectItem>
                <SelectItem value="ACTIVE">Идэвхтэй</SelectItem>
                <SelectItem value="INACTIVE">Идэвхгүй</SelectItem>
                <SelectItem value="UNSUBSCRIBED">Орхисон</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryId || 'all'} onValueChange={(v) => { setCategoryId(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Категори" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх категори</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.count})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source || 'all'} onValueChange={(v) => { setSource(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Эх сурвалж" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх эх сурвалж</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {(status || categoryId || source || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setStatus(''); setCategoryId(''); setSource(''); setSearch(''); setPage(1); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {/* Bulk action bar — сонгосон захиалагч дээр үйлдэл */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} сонгогдсон</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={(v) => bulkAssignMut.mutate(v === 'none' ? null : v)}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Категорид зүүх" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Категори хасах</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Устгах ({selectedIds.size})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Цуцлах</Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Ачаалж байна...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Subscriber олдсонгүй</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border cursor-pointer"
                        checked={items.length > 0 && items.every((s) => selectedIds.has(s.id))}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? new Set(items.map((s) => s.id)) : new Set())
                        }
                      />
                    </th>
                    <th className="px-4 py-2.5 font-medium">Имэйл</th>
                    <th className="px-4 py-2.5 font-medium">Нэр</th>
                    <th className="px-4 py-2.5 font-medium">Төлөв</th>
                    <th className="px-4 py-2.5 font-medium">Категори</th>
                    <th className="px-4 py-2.5 font-medium">Эх сурвалж</th>
                    <th className="px-4 py-2.5 font-medium">Огноо</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className={`border-b border-border/50 hover:bg-muted/30 ${selectedIds.has(s.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border cursor-pointer"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium">{s.email}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                        {s.sex && <span className="ml-1 text-xs">({SEX_LABEL[s.sex]})</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[10px] ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.category?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.source || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString('mn-MN')}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Нэгдсэн Pagination (custom pageSize-тэй) */}
      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
      />

      <SubscriberDialog open={dialogOpen} subscriber={editing} categories={categories} onClose={() => setDialogOpen(false)} />
      <CategoryDialog open={catDialogOpen} categories={categories} onClose={() => setCatDialogOpen(false)} />

      {/* Bulk delete баталгаажуулах */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{selectedIds.size} subscriber устгах уу?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Энэ үйлдлийг буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Цуцлах</Button>
            <Button variant="destructive" disabled={bulkDeleteMut.isPending} onClick={() => bulkDeleteMut.mutate()}>
              {bulkDeleteMut.isPending ? 'Устгаж байна...' : `Устгах (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Subscriber устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && <p className="text-sm text-muted-foreground">{deleteTarget.email}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
