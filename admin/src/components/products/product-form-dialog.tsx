'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, Check, CheckCircle2, ChevronDown, ChevronUp, Clock, Copy, Download, FileText, FolderOpen, FolderPlus, GripVertical, Loader2, Lock, Package, Paperclip, Pencil, Play, Plus, Sparkles, Star, Trash2, Upload, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
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
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { API_URL } from '@/lib/constants';
import type { AdminBundle, AdminBundleItem, AdminCourseModule, AdminFaq, AdminLesson, AdminLessonResource, AdminProduct, AdminProductFile, AdminProductImage, AdminTestimonial } from '@/types/admin';
import { RichEditor } from '@/components/ui/rich-editor';


interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: AdminProduct | null;
}

interface HowToUseStep {
  title: string;
  description: string;
}

const DEFAULT_HOW_TO_USE = '<p>Та дараах алхмуудаар дижитал бүтээгдэхүүнийг авч хэрэглэнэ үү. Асуулт гарвал <strong>info@digitalger.mn</strong> хаягаар эсвэл баруун доод буланд байрлах AI чат зөвлөхтэй холбогдоорой!</p>';

const DEFAULT_HOW_TO_USE_STEPS: HowToUseStep[] = [
  { title: 'Төлбөрийг хялбар систем', description: 'QPay болон банкны картаар хялбар, аюулгүй төлбөр хийнэ.' },
  { title: 'Шууд татах линк', description: 'Төлбөр амжилттай болмогц файл татах линк автоматаар ирнэ.' },
  { title: 'Шууд ашиглахад бэлэн', description: 'Татаж авсан файлаа нээж шууд ашиглана. Тусламж хэрэгтэй бол бидэнтэй холбогдоорой.' },
];

const DEFAULT_PROOF = {
  proofImageUrl: '',
  proofQuote: '',
  proofText: '',
  proofAuthorName: '',
  proofAuthorRole: '',
};

const emptyForm = {
  title: '',
  slug: '',
  description: '',
  price: '',
  compareAtPrice: '',
  type: '' as string,
  types: [] as string[],
  categoryId: '',
  categoryIds: [] as string[],
  published: false,
  featured: false,
  seoTitle: '',
  seoDescription: '',
  howToUse: DEFAULT_HOW_TO_USE,
  whatsIncluded: '',
  discountEndsAt: '',
  howToUseSteps: DEFAULT_HOW_TO_USE_STEPS,
  rating: '0',
  ratingCount: '0',
  ...DEFAULT_PROOF,
};

function PopoverMultiSelect<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const labels = selected.map((v) => options.find((o) => o.value === v)?.label ?? v);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="truncate text-left">
          {labels.length > 0 ? labels.join(', ') : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          <div className="max-h-52 overflow-y-auto p-1">
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    const next = checked ? selected.filter((v) => v !== opt.value) : [...selected, opt.value];
                    onChange(next.length > 0 ? next : selected);
                  }}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/--+/g, '-');
}

// FAQ assignment tab — state lives in parent to survive tab switches
function FaqAssignTab({
  selectedIds,
  onToggle,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { data: allFaqs = [], isLoading } = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: () => adminApi.faqs.list(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Ачаалж байна...</p>;
  if (!allFaqs.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Глобал FAQ байхгүй байна. Эхлээд <span className="font-medium text-foreground">FAQ</span> хуудаснаас нэмнэ үү.
    </div>
  );

  const byCategory = allFaqs.reduce<Record<string, AdminFaq[]>>((acc, faq) => {
    const cat = faq.category ?? 'Бусад';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  const selectedCount = allFaqs.filter((f) => selectedIds.has(f.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Энэ бүтээгдэхүүнд харагдуулах FAQ-уудыг сонгоно уу.</p>
        {selectedCount > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{selectedCount} сонгосон</span>
        )}
      </div>
      {Object.entries(byCategory).map(([cat, faqs]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-1.5">
            {faqs.map((faq) => (
              <label key={faq.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${selectedIds.has(faq.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                  checked={selectedIds.has(faq.id)}
                  onChange={() => onToggle(faq.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{faq.question}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{faq.answer}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Testimonial assignment tab — state lives in parent to survive tab switches
function TestimonialAssignTab({
  selectedIds,
  onToggle,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { data: allTestimonials = [], isLoading } = useQuery({
    queryKey: ['admin', 'testimonials'],
    queryFn: () => adminApi.testimonials.list(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Ачаалж байна...</p>;
  if (!allTestimonials.length) return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      Сэтгэгдэл байхгүй байна. Эхлээд <span className="font-medium">Сэтгэгдэл</span> хуудаснаас нэмнэ үү.
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Бүтээгдэхүүний дэлгэрэнгүй хуудаст харагдуулах сэтгэгдлүүдийг сонгоно уу.</p>
      {allTestimonials.map((t: AdminTestimonial) => (
        <label key={t.id} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${selectedIds.has(t.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary shrink-0"
            checked={selectedIds.has(t.id)}
            onChange={() => onToggle(t.id)}
          />
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {t.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.avatar} alt={t.name} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {t.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold leading-tight">{t.name}</p>
                {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                {t.rating > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-500">
                    {'★'.repeat(t.rating)}
                  </span>
                )}
              </div>
              {t.content && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{t.content}</p>
              )}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

// Bundle management tab
function BundleTab({ productId }: { productId?: string }) {
  const queryClient = useQueryClient();
  const [newBundleTitle, setNewBundleTitle] = useState('');
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});
  const [editingBundle, setEditingBundle] = useState<string | null>(null);
  const [editBundleTitle, setEditBundleTitle] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemLabel, setEditItemLabel] = useState('');
  const [openBundles, setOpenBundles] = useState<Record<string, boolean>>({});
  const toggleBundle = (id: string) => setOpenBundles((p) => ({ ...p, [id]: p[id] !== false ? false : true }));
  const isBundleOpen = (id: string) => openBundles[id] === true;

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'bundles'],
    queryFn: () => adminApi.bundles.list(productId!),
    enabled: !!productId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'bundles'] });

  const createBundleMut = useMutation({
    mutationFn: () => adminApi.bundles.create(productId!, { title: newBundleTitle, sortOrder: bundles.length }),
    onSuccess: () => { toast.success('Бүлэг нэмэгдлээ'); setNewBundleTitle(''); invalidate(); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const updateBundleMut = useMutation({
    mutationFn: (id: string) => adminApi.bundles.update(productId!, id, { title: editBundleTitle }),
    onSuccess: () => { toast.success('Шинэчлэгдлээ'); setEditingBundle(null); invalidate(); },
  });

  const removeBundleMut = useMutation({
    mutationFn: (id: string) => adminApi.bundles.remove(productId!, id),
    onSuccess: () => { toast.success('Устгагдлаа'); invalidate(); },
  });

  const addItemMut = useMutation({
    mutationFn: ({ bundleId, name }: { bundleId: string; name: string }) =>
      adminApi.bundles.addItem(productId!, bundleId, { name, sortOrder: 0 }),
    onSuccess: (_data, { bundleId }) => {
      setNewItemInputs((p) => ({ ...p, [bundleId]: '' }));
      invalidate();
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ bundleId, itemId, name, label }: { bundleId: string; itemId: string; name: string; label?: string }) =>
      adminApi.bundles.updateItem(productId!, bundleId, itemId, { name, label: label || undefined }),
    onSuccess: () => { toast.success('Засагдлаа'); setEditingItem(null); invalidate(); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const removeItemMut = useMutation({
    mutationFn: ({ bundleId, itemId }: { bundleId: string; itemId: string }) =>
      adminApi.bundles.removeItem(productId!, bundleId, itemId),
    onSuccess: () => { toast.success('Устгагдлаа'); invalidate(); },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Ачаалж байна...</p>;

  return (
    <div className="space-y-4">
      {bundles.map((bundle: AdminBundle, bi) => (
        <div key={bundle.id} className="rounded-lg border border-border overflow-hidden">
          {/* Bundle header */}
          <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 hover:bg-muted/60 transition-colors">
            <button
              type="button"
              onClick={() => toggleBundle(bundle.id)}
              className="shrink-0 flex items-center"
            >
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isBundleOpen(bundle.id) ? '' : '-rotate-90'}`} />
            </button>
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            {editingBundle === bundle.id ? (
              <>
                <Input
                  value={editBundleTitle}
                  onChange={(e) => setEditBundleTitle(e.target.value)}
                  className="h-7 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') updateBundleMut.mutate(bundle.id); if (e.key === 'Escape') setEditingBundle(null); }}
                />
                <Button size="sm" className="h-7 text-xs px-2" onClick={() => updateBundleMut.mutate(bundle.id)}>Хадгалах</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingBundle(null)}>Болих</Button>
              </>
            ) : (
              <>
                <span
                  className="flex-1 text-sm font-semibold cursor-pointer"
                  onClick={() => toggleBundle(bundle.id)}
                >
                  {bi + 1}. {bundle.title}
                </span>
                <span className="text-xs text-muted-foreground mr-1">{bundle.items.length} зүйл</span>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => { setEditingBundle(bundle.id); setEditBundleTitle(bundle.title); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm('Бүлэг болон түүний бүх зүйлийг устгах уу?')) removeBundleMut.mutate(bundle.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          {/* Bundle items */}
          {isBundleOpen(bundle.id) && <div className="divide-y divide-border">
            {bundle.items.map((item: AdminBundleItem, ii) => (
              <div key={item.id} className="px-3 py-2">
                {editingItem === item.id ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{ii + 1}.</span>
                      <Input
                        value={editItemName}
                        onChange={(e) => setEditItemName(e.target.value)}
                        className="h-7 text-xs flex-1"
                        autoFocus
                        placeholder="Зүйлийн нэр"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editItemName.trim()) updateItemMut.mutate({ bundleId: bundle.id, itemId: item.id, name: editItemName.trim(), label: editItemLabel });
                          if (e.key === 'Escape') setEditingItem(null);
                        }}
                      />
                      <Input
                        value={editItemLabel}
                        onChange={(e) => setEditItemLabel(e.target.value)}
                        className="h-7 text-xs w-28 shrink-0"
                        placeholder="PDF + DOCX"
                      />
                      <Button size="sm" className="h-7 text-xs px-2 shrink-0"
                        disabled={!editItemName.trim() || updateItemMut.isPending}
                        onClick={() => updateItemMut.mutate({ bundleId: bundle.id, itemId: item.id, name: editItemName.trim(), label: editItemLabel })}>
                        Хадгалах
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 shrink-0" onClick={() => setEditingItem(null)}>Болих</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{ii + 1}.</span>
                    <span className="flex-1 text-sm">{item.name}</span>
                    {item.label && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{item.label}</span>
                    )}
                    {item.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-24 hidden sm:block">{item.description}</span>
                    )}
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                      onClick={() => { setEditingItem(item.id); setEditItemName(item.name); setEditItemLabel(item.label ?? ''); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                      onClick={() => { if (confirm('Зүйл устгах уу?')) removeItemMut.mutate({ bundleId: bundle.id, itemId: item.id }); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Add item row */}
            <div className="flex gap-2 p-2">
              <Input
                value={newItemInputs[bundle.id] ?? ''}
                onChange={(e) => setNewItemInputs((p) => ({ ...p, [bundle.id]: e.target.value }))}
                placeholder="Шинэ зүйл нэмэх..."
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemInputs[bundle.id]) {
                    e.preventDefault();
                    addItemMut.mutate({ bundleId: bundle.id, name: newItemInputs[bundle.id] });
                  }
                }}
              />
              <Button size="sm" className="h-7 text-xs px-2 shrink-0"
                disabled={!newItemInputs[bundle.id] || addItemMut.isPending}
                onClick={() => addItemMut.mutate({ bundleId: bundle.id, name: newItemInputs[bundle.id] ?? '' })}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>}
        </div>
      ))}

      <Separator />
      <div className="flex gap-2">
        <Input
          value={newBundleTitle}
          onChange={(e) => setNewBundleTitle(e.target.value)}
          placeholder={productId ? 'Шинэ бүлгийн нэр (жишээ: Үндсэн файлууд)' : 'Хадгалсны дараа бүлэг нэмнэ үү'}
          disabled={!productId}
          onKeyDown={(e) => { if (e.key === 'Enter' && newBundleTitle && productId) createBundleMut.mutate(); }}
        />
        <Button
          onClick={() => {
            if (!productId) { toast.info('Эхлээд бүтээгдэхүүнийг хадгалж, дараа бүлэг нэмнэ үү'); return; }
            createBundleMut.mutate();
          }}
          disabled={!newBundleTitle || createBundleMut.isPending || !productId}
          className="shrink-0"
        >
          <Plus className="mr-1 h-4 w-4" /> Бүлэг нэмэх
        </Button>
      </div>
    </div>
  );
}

// Files management tab
function parseDurationToSec(val: string): number | undefined {
  val = val.trim();
  if (!val) return undefined;
  if (val.includes(':')) {
    const parts = val.split(':').map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  const n = Number(val);
  return isNaN(n) ? undefined : n * 60;
}

function formatDurationInput(sec: number | null | undefined): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(m);
}

function formatDurationLabel(sec: number | null | undefined): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ц ${m}м`;
  if (m > 0) return `${m}м${s > 0 ? ` ${s}с` : ''}`;
  return `${s}с`;
}

function getVideoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Stream видеоны төлвийн badge — uploading/processing/ready/failed
function StreamStatusBadge({ status }: { status?: string | null }) {
  const st = (status ?? '').toLowerCase();
  // Cloudflare-ийн төлвүүд: pendingupload/queued/inprogress/downloading → боловсруулж байна
  const isReady = st === 'ready';
  const isError = st === 'error' || st === 'failed';
  const isProcessing = !isReady && !isError && !!st;

  if (isReady) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-2.5 w-2.5" /> Бэлэн
      </span>
    );
  }
  if (isError) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
        <AlertTriangle className="h-2.5 w-2.5" /> Алдаа
      </span>
    );
  }
  if (isProcessing) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Боловсруулж байна
      </span>
    );
  }
  return null;
}

// ── Хичээлийн хавсралт / татах материал хэсэг (R2 файл upload) ───────────────
function LessonResources({ productId, lessonId }: { productId: string; lessonId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'lessons', lessonId, 'resources'],
    queryFn: () => adminApi.products.lessons.resources.list(productId, lessonId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'lessons', lessonId, 'resources'] });

  const removeMut = useMutation({
    mutationFn: (resourceId: string) => adminApi.products.lessons.resources.remove(productId, lessonId, resourceId),
    onMutate: async (resourceId: string) => {
      const key = ['admin', 'products', productId, 'lessons', lessonId, 'resources'];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<AdminLessonResource[]>(key);
      queryClient.setQueryData<AdminLessonResource[]>(key, (old) => old?.filter((r) => r.id !== resourceId) ?? old);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin', 'products', productId, 'lessons', lessonId, 'resources'], ctx.prev);
      toast.error('Устгахад алдаа гарлаа');
    },
    onSuccess: () => toast.success('Хавсралт устгагдлаа'),
    onSettled: () => invalidate(),
  });

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setUploading(true);
    try {
      for (const file of picked) {
        const r = await uploadFileWithToast(file);
        await adminApi.products.lessons.resources.add(productId, lessonId, {
          fileKey: r.key,
          fileName: file.name,
          mimeType: file.type || undefined,
          sizeBytes: file.size,
        });
      }
      if (picked.length > 1) toast.success(`${picked.length} хавсралт нэмэгдлээ`);
      else toast.success('Хавсралт нэмэгдлээ');
      invalidate();
    } catch {
      toast.error('Хавсралт нэмэхэд алдаа гарлаа');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
          <Paperclip className="h-3 w-3" /> Хавсралт / Татах материал
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? 'Ачаалж байна...' : 'Файл нэмэх'}
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Ачаалж байна...</p>
      ) : resources.length > 0 ? (
        <div className="space-y-1">
          {resources.map((res) => (
            <div key={res.id} className="flex items-center gap-2 rounded-md bg-muted/40 border border-border px-2 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary/60" />
              <span className="text-xs flex-1 truncate font-medium">{res.fileName}</span>
              {res.sizeBytes ? (
                <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(res.sizeBytes)}</span>
              ) : null}
              <Button
                type="button" size="icon" variant="ghost"
                className="h-5 w-5 text-destructive hover:text-destructive shrink-0"
                onClick={() => { if (confirm('Хавсралт устгах уу?')) removeMut.mutate(res.id); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/70">Хавсралт байхгүй. PDF, ZIP, дасгал зэрэг материал нэмж болно.</p>
      )}
    </div>
  );
}

const UPLOAD_PROGRESS_THRESHOLD = 5 * 1024 * 1024;   // 5MB-с дээш → progress toast
const PRESIGN_THRESHOLD = 100 * 1024 * 1024;          // 100MB-с дээш → presigned R2 direct upload

async function uploadWithProgress(
  file: File,
  token?: string,
  onProgress?: (pct: number) => void,
): Promise<Awaited<ReturnType<typeof adminApi.upload>>> {
  // 100MB-с дээш → presigned URL-ээр browser→R2 шууд upload
  if (file.size >= PRESIGN_THRESHOLD) {
    const { uploadUrl, key, publicUrl } = await adminApi.presignUpload({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
    return { key, url: publicUrl, fileName: file.name, mimeType: file.type, size: file.size };
  }

  if (!token) {
    return adminApi.upload(file, onProgress);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(xhr.responseText || xhr.statusText));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', `${API_URL}/api/uploads`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}

// Token-гүйгээр progress toast-тай upload хийх helper
async function uploadFileWithToast(file: File): Promise<Awaited<ReturnType<typeof adminApi.upload>>> {
  const { toast: sonnerToast } = await import('sonner');
  const showProgress = file.size >= UPLOAD_PROGRESS_THRESHOLD;
  const toastId = showProgress ? `upload-${Date.now()}-${Math.random()}` : undefined;
  const mb = (file.size / (1024 * 1024)).toFixed(1);

  if (toastId) {
    sonnerToast.loading(`Байршуулж байна... (0%) — ${file.name} (${mb} MB)`, { id: toastId, duration: Infinity });
  }

  const onProgress = toastId
    ? (percent: number) => {
        if (percent < 100) {
          sonnerToast.loading(`Байршуулж байна... (${percent}%) — ${file.name} (${mb} MB)`, { id: toastId, duration: Infinity });
        }
      }
    : undefined;

  try {
    const result = file.size >= PRESIGN_THRESHOLD
      ? await uploadWithProgress(file, undefined, onProgress)
      : await adminApi.upload(file, onProgress);
    if (toastId) sonnerToast.success(`Байршуулагдлаа — ${file.name}`, { id: toastId, duration: 2500 });
    return result;
  } catch (err) {
    if (toastId) sonnerToast.error(`Байршуулахад алдаа — ${file.name}`, { id: toastId, duration: 3000 });
    throw err;
  }
}

/**
 * Browser→Cloudflare Stream шууд upload (direct upload URL руу).
 * Cloudflare direct_upload URL нь энгийн POST (multipart/form-data, field name="file") дэмждэг.
 * Progress: XMLHttpRequest upload.onprogress.
 */
async function streamDirectUpload(
  uploadURL: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadURL);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Stream upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

/**
 * Stream видеоны боловсруулалт дуустал (status === 'ready') polling хийнэ.
 * 3 секунд тутамд шалгаж, дээд тал нь ~10 минут хүлээнэ.
 */
async function pollStreamReady(
  productId: string,
  uid: string,
  onTick?: (st: { status: string; durationSec: number | null; thumbnail: string | null; ready: boolean }) => void,
): Promise<{ status: string; durationSec: number | null; thumbnail: string | null; ready: boolean }> {
  const maxAttempts = 200; // 200 * 3s ≈ 10 минут
  let last = { status: 'queued', durationSec: null as number | null, thumbnail: null as string | null, ready: false };
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const st = await adminApi.products.lessons.streamStatus(productId, uid);
      last = st;
      onTick?.(st);
      if (st.ready || st.status === 'ready') return st;
      if (st.status === 'error') return st;
    } catch {
      // түр алдаа — дахин оролдоно
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return last;
}

function VideoUploadInput({
  productId,
  videoUrl, setVideoUrl,
  videoKey, setVideoKey,
  videoStreamId, setVideoStreamId,
  setStreamStatus,
  duration, setDuration,
  onUploadingChange,
}: {
  productId: string;
  videoUrl: string; setVideoUrl: (v: string) => void;
  videoKey: string; setVideoKey: (v: string) => void;
  videoStreamId: string; setVideoStreamId: (v: string) => void;
  setStreamStatus: (v: string) => void;
  duration: string; setDuration: (v: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  // Идэвхтэй эх сурвалжаар tab сонгох: байгаа утгаас автоматаар тодорхойлно
  const initialMode: 'stream' | 'url' = videoUrl && !videoStreamId ? 'url' : 'stream';
  const [mode, setMode] = useState<'stream' | 'url'>(initialMode);

  // R2 upload (хуучин видеотой лессонд хадгалагдсан байж болзошгүй — устгах боломжтой үлдээв)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedName, setUploadedName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stream upload төлөв
  const [streamUploading, setStreamUploading] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamPhase, setStreamPhase] = useState<'idle' | 'uploading' | 'processing' | 'ready' | 'error'>(
    videoStreamId ? 'ready' : 'idle',
  );
  const [streamFileName, setStreamFileName] = useState('');
  const streamFileRef = useRef<HTMLInputElement>(null);

  const isYoutube = videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'));
  const isVimeo = videoUrl && videoUrl.includes('vimeo.com');
  const videoLabel = videoKey ? 'Байршуулсан' : isYoutube ? 'YouTube' : isVimeo ? 'Vimeo' : videoUrl ? 'Видео' : null;
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;

  const busy = uploading || streamUploading;

  // Auto-detect duration from YouTube / Vimeo URLs
  useEffect(() => {
    if (!videoUrl || videoKey) return;
    if (!isYoutube && !isVimeo) return;

    const controller = new AbortController();

    if (isVimeo) {
      const match = videoUrl.match(/vimeo\.com\/(\d+)/);
      if (!match) return;
      // Use Vimeo oEmbed endpoint — no auth needed, returns duration
      fetch(`https://vimeo.com/api/v2/video/${match[1]}.json`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: any) => {
          const sec: number = Array.isArray(data) ? data[0]?.duration : data?.duration;
          if (sec > 0) setDuration(formatDurationInput(sec));
        })
        .catch(() => {});
    }

    if (isYoutube) {
      const match = videoUrl.match(/(?:v=|youtu\.be\/)([^&\s?]+)/);
      if (!match) return;
      // YouTube oEmbed doesn't expose duration — use noembed.com proxy
      fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: any) => {
          // noembed doesn't return duration either; clear so user enters manually
          void data;
        })
        .catch(() => {});
    }

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // ── Cloudflare Stream upload урсгал ──────────────────────────────────────────
  async function handleStreamFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Локал metadata-аас хугацаа автоматаар тодорхойлно (fallback)
    const objUrl = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.src = objUrl;
    vid.onloadedmetadata = () => {
      const sec = Math.round(vid.duration);
      if (sec > 0 && !duration) setDuration(formatDurationInput(sec));
      URL.revokeObjectURL(objUrl);
    };

    const toastId = `stream-${Date.now()}`;
    setStreamFileName(file.name);
    setStreamUploading(true);
    onUploadingChange?.(true);
    setStreamProgress(0);
    setStreamPhase('uploading');

    try {
      // 1. Direct upload URL авах
      const { uploadURL, uid } = await adminApi.products.lessons.streamUpload(productId, { name: file.name });

      // 2. Browser → Cloudflare шууд upload (progress-той)
      toast.loading(`Stream-д байршуулж байна... (0%)`, { id: toastId, duration: Infinity });
      await streamDirectUpload(uploadURL, file, (pct) => {
        setStreamProgress(pct);
        if (pct < 100) toast.loading(`Stream-д байршуулж байна... (${pct}%)`, { id: toastId, duration: Infinity });
      });

      // 3. Боловсруулалт дуустал polling (status === 'ready')
      setStreamPhase('processing');
      toast.loading('Видео боловсруулж байна...', { id: toastId, duration: Infinity });

      const ready = await pollStreamReady(productId, uid, (st) => {
        if (st.status === 'inprogress' || st.status === 'queued' || st.status === 'downloading') {
          toast.loading('Видео боловсруулж байна...', { id: toastId, duration: Infinity });
        }
      });

      if (!ready.ready) throw new Error('processing timeout');

      // 4. Лессонд хадгалах утгуудыг тавина (Stream = гол; R2/URL цэвэрлэнэ)
      setVideoStreamId(uid);
      setStreamStatus('ready');
      setVideoKey('');
      setVideoUrl('');
      setUploadedName('');
      if (ready.durationSec && ready.durationSec > 0) setDuration(formatDurationInput(ready.durationSec));
      setStreamPhase('ready');
      toast.success('Видео бэлэн боллоо', { id: toastId, duration: 2500 });
    } catch (err) {
      setStreamPhase('error');
      toast.error('Stream-д байршуулахад алдаа гарлаа', { id: toastId, duration: 3500 });
      void err;
    } finally {
      setStreamUploading(false);
      onUploadingChange?.(false);
    }
  }

  function clearStream() {
    setVideoStreamId('');
    setStreamStatus('');
    setStreamFileName('');
    setStreamPhase('idle');
    setStreamProgress(0);
  }

  // ── R2 upload урсгал (хуучин — устгах/солих боломжтой үлдээв) ─────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-detect duration from local video metadata
    const objUrl = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.src = objUrl;
    vid.onloadedmetadata = () => {
      const sec = Math.round(vid.duration);
      if (sec > 0) setDuration(formatDurationInput(sec));
      URL.revokeObjectURL(objUrl);
    };

    setUploading(true);
    onUploadingChange?.(true);
    setUploadProgress(0);
    try {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : {};
      const token = meData.accessToken ?? '';
      const result = await uploadWithProgress(file, token, setUploadProgress);
      setVideoKey(result.key);
      setVideoUrl('');
      setUploadedName(file.name);
    } catch {
      toast.error('Видео байршуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-2">
      {/* Видео эх сурвалжийн tab: Stream (зөвлөмж) | Гадаад линк */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'stream' | 'url')}>
        <TabsList className="h-7 p-0.5">
          <TabsTrigger value="stream" className="h-6 text-[11px] px-2 gap-1">
            <Upload className="h-3 w-3" />Видео байршуулах
          </TabsTrigger>
          <TabsTrigger value="url" className="h-6 text-[11px] px-2 gap-1">
            <Play className="h-3 w-3" />Гадаад линк
          </TabsTrigger>
        </TabsList>

        {/* ── Stream upload tab (ҮНДСЭН арга) ── */}
        <TabsContent value="stream" className="mt-2 space-y-2">
          <input
            ref={streamFileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleStreamFile}
            disabled={busy}
          />

          {/* Idle: drag/file picker */}
          {streamPhase !== 'ready' && !streamUploading && (
            <button
              type="button"
              onClick={() => streamFileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/10 px-3 py-4 text-center transition hover:border-primary/50 hover:bg-muted/20"
            >
              <Upload className="h-5 w-5 text-primary/60" />
              <span className="text-xs font-medium">Видео файл сонгох (Cloudflare Stream)</span>
              <span className="text-[10px] text-muted-foreground">Том файлыг найдвартай байршуулж, автоматаар боловсруулна</span>
            </button>
          )}

          {/* Uploading / processing */}
          {streamUploading && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                  {streamPhase === 'processing' ? 'Боловсруулж байна...' : 'Байршуулж байна...'}
                  {streamFileName && <span className="truncate text-[10px] opacity-70">— {streamFileName}</span>}
                </span>
                {streamPhase === 'uploading' && <span className="font-semibold text-primary shrink-0">{streamProgress}%</span>}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${streamPhase === 'processing' ? 'bg-amber-500 animate-pulse w-full' : 'bg-primary'}`}
                  style={streamPhase === 'uploading' ? { width: `${streamProgress}%` } : undefined}
                />
              </div>
            </div>
          )}

          {/* Ready */}
          {streamPhase === 'ready' && videoStreamId && !streamUploading && (
            <div className="flex items-center gap-1.5 rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1.5 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate font-medium">{streamFileName || 'Stream видео бэлэн'}</span>
              <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-800/40 px-1.5 py-0.5 text-[10px] font-semibold">Stream</span>
              <button type="button" onClick={clearStream} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Error */}
          {streamPhase === 'error' && !streamUploading && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              Байршуулалт амжилтгүй. Дахин оролдоно уу.
            </p>
          )}

          {/* R2-д хадгалагдсан хуучин видео (Stream руу шилжээгүй) */}
          {videoKey && !videoStreamId && (
            <div className="flex items-center gap-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-1.5 text-xs text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate font-medium">{uploadedName || 'R2-д хадгалагдсан видео'}</span>
              <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 text-[10px] font-semibold">R2</span>
              <button type="button" onClick={() => { setVideoKey(''); setUploadedName(''); }} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </TabsContent>

        {/* ── Гадаад линк tab (YouTube/Vimeo, хэвээр) ── */}
        <TabsContent value="url" className="mt-2 space-y-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Input
                value={videoKey ? '' : videoUrl}
                onChange={(e) => { setVideoUrl(e.target.value); setVideoKey(''); setUploadedName(''); setShowPreview(false); }}
                placeholder={videoKey ? (uploadedName || 'Файл байршуулагдсан') : 'YouTube / Vimeo URL...'}
                className="h-7 text-xs pr-20"
                disabled={!!videoKey || busy}
              />
              {videoLabel && !videoKey && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-primary/70">{videoLabel}</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} disabled={busy} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 gap-1 shrink-0"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              R2
            </Button>
          </div>

          {/* YouTube: manual duration hint */}
          {isYoutube && !busy && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              YouTube-ийн хугацааг гараар оруулна уу (мм:сс)
            </p>
          )}

          {/* R2 Upload progress bar */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Байршуулж байна...
                </span>
                <span className="font-semibold text-primary">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Uploaded R2 file success indicator */}
          {videoKey && !uploading && (
            <div className="flex items-center gap-1.5 rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1.5 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate font-medium">{uploadedName || 'Видео байршуулагдлаа'}</span>
              <button type="button" onClick={() => { setVideoKey(''); setUploadedName(''); setShowPreview(false); }} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Preview toggle */}
          {(embedUrl || videoKey) && !busy && (
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Play className="h-3 w-3" />
              {showPreview ? 'Preview хаах' : 'Preview харах'}
            </button>
          )}

          {/* Preview iframe / placeholder */}
          {showPreview && !busy && (
            <div className="rounded-lg overflow-hidden bg-black">
              {embedUrl ? (
                <div className="relative aspect-video">
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : videoKey ? (
                <div className="aspect-video flex items-center justify-center text-white/40 text-xs">
                  Хадгалсны дараа preview харах боломжтой
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  total,
  productId,
  onMoved,
  onDeleted,
  onUpdated,
}: {
  lesson: AdminLesson;
  index: number;
  total: number;
  productId: string;
  onMoved: (dir: 'up' | 'down') => void;
  onDeleted: () => void;
  onUpdated: (l: AdminLesson) => void;
}) {
  // Drag-drop reorder (up/down товчтой зэрэгцэн ажиллана)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 30 : undefined,
  };

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? '');
  const [videoKey, setVideoKey] = useState(lesson.videoKey ?? '');
  const [videoStreamId, setVideoStreamId] = useState(lesson.videoStreamId ?? '');
  const [streamStatus, setStreamStatus] = useState(lesson.streamStatus ?? '');
  const [duration, setDuration] = useState(formatDurationInput(lesson.durationSec));
  const [freePreview, setFreePreview] = useState(lesson.isFreePreview);
  const [description, setDescription] = useState(lesson.description ?? '');
  const [content, setContent] = useState(lesson.content ?? '');
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Sync state when lesson prop updates (after save + invalidate)
  useEffect(() => {
    if (!editing) {
      setTitle(lesson.title);
      setVideoUrl(lesson.videoUrl ?? '');
      setVideoKey(lesson.videoKey ?? '');
      setVideoStreamId(lesson.videoStreamId ?? '');
      setStreamStatus(lesson.streamStatus ?? '');
      setDuration(formatDurationInput(lesson.durationSec));
      setFreePreview(lesson.isFreePreview);
      setDescription(lesson.description ?? '');
      setContent(lesson.content ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const durationSec = parseDurationToSec(duration);
      // Stream видео байвал гол → videoKey/videoUrl хоосон (backend mutually exclusive)
      const updated = await adminApi.products.lessons.update(productId, lesson.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        content: stripHtml(content) ? content : '',
        videoStreamId: videoStreamId || undefined,
        streamStatus: videoStreamId ? (streamStatus || 'ready') : undefined,
        videoUrl: videoStreamId ? undefined : (videoKey ? undefined : (videoUrl.trim() || undefined)),
        videoKey: videoStreamId ? undefined : (videoKey || undefined),
        durationSec,
        isFreePreview: freePreview,
      });
      onUpdated(updated);
      setEditing(false);
      toast.success('Хичээл шинэчлэгдлээ');
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setTitle(lesson.title);
    setVideoUrl(lesson.videoUrl ?? '');
    setVideoKey(lesson.videoKey ?? '');
    setVideoStreamId(lesson.videoStreamId ?? '');
    setStreamStatus(lesson.streamStatus ?? '');
    setDuration(formatDurationInput(lesson.durationSec));
    setFreePreview(lesson.isFreePreview);
    setDescription(lesson.description ?? '');
    setContent(lesson.content ?? '');
    setEditing(false);
  }

  const hasStream = !!lesson.videoStreamId;
  const isYoutube = lesson.videoUrl && (lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be'));
  const isVimeo = lesson.videoUrl && lesson.videoUrl.includes('vimeo.com');
  const videoLabel = hasStream ? 'Stream' : lesson.videoKey ? 'Байршуулсан' : isYoutube ? 'YouTube' : isVimeo ? 'Vimeo' : lesson.videoUrl ? 'Видео' : null;

  return (
    <div ref={setNodeRef} style={sortableStyle} className="rounded-lg border border-border overflow-hidden bg-background">
      <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/20">
        {/* Drag handle (up/down товчтой зэрэгцэн) */}
        {!editing ? (
          <button
            type="button"
            className="shrink-0 mt-0.5 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            title="Чирж эрэмбэлэх"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="shrink-0 w-4" />
        )}
        <span className="shrink-0 w-5 text-center font-mono text-xs font-bold text-primary/40 mt-0.5">{index + 1}</span>

        {editing ? (
          <div className="flex-1 space-y-2.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Хичээлийн гарчиг *"
              className="h-8 text-sm"
              autoFocus
            />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Богино тайлбар (жагсаалтад)</p>
              <RichEditor
                value={description}
                onChange={setDescription}
                placeholder="Хичээлийн товч тайлбар — жагсаалтад харагдана (заавал биш)"
                minHeight="60px"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Хичээлийн агуулга (дэлгэрэнгүй тэмдэглэл)</p>
              <RichEditor
                value={content}
                onChange={setContent}
                placeholder="Дэлгэрэнгүй тэмдэглэл, код, зураг, алхмууд — суралцагчид видеоны доор харагдана (заавал биш)"
                minHeight="120px"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
              <VideoUploadInput
                productId={productId}
                videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                videoKey={videoKey} setVideoKey={setVideoKey}
                videoStreamId={videoStreamId} setVideoStreamId={setVideoStreamId}
                setStreamStatus={setStreamStatus}
                duration={duration} setDuration={setDuration}
                onUploadingChange={setIsUploading}
              />
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="мм:сс"
                className="h-7 text-xs w-24"
              />
            </div>
            {/* Хавсралт / татах материал */}
            <div className="rounded-lg border border-border bg-muted/10 p-2.5">
              <LessonResources productId={productId} lessonId={lesson.id} />
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={freePreview} onChange={(e) => setFreePreview(e.target.checked)} />
                <span>Үнэгүй урьдчилсан харагдах</span>
              </label>
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 text-xs px-2.5 gap-1" onClick={handleSave} disabled={saving || isUploading || !title.trim()}>
                  {isUploading ? 'Байршуулж байна...' : saving ? '...' : 'Хадгалах'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleCancel}>Болих</Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{lesson.title}</span>
                {lesson.isFreePreview && (
                  <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">Preview</span>
                )}
              </div>
              {lesson.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{stripHtml(lesson.description)}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {hasStream ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Play className="h-2.5 w-2.5" />Stream
                  </span>
                ) : videoLabel ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-primary/70">
                    <Play className="h-2.5 w-2.5" />{videoLabel}
                  </span>
                ) : null}
                {/* Stream боловсруулалтын төлөв */}
                {hasStream && <StreamStatusBadge status={lesson.streamStatus} />}
                {lesson.durationSec && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />{formatDurationLabel(lesson.durationSec)}
                  </span>
                )}
                {lesson.content && stripHtml(lesson.content) && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <FileText className="h-2.5 w-2.5" />Тэмдэглэлтэй
                  </span>
                )}
                {lesson.resources && lesson.resources.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Paperclip className="h-2.5 w-2.5" />{lesson.resources.length} хавсралт
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMoved('up')}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMoved('down')}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => { if (confirm('Хичээл устгах уу?')) onDeleted(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Add lesson inline form ────────────────────────────────────────────────────
function AddLessonForm({
  productId,
  moduleId,
  lessonCount,
  onAdded,
  onCancel,
}: {
  productId: string;
  moduleId?: string;
  lessonCount: number;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoKey, setVideoKey] = useState('');
  const [videoStreamId, setVideoStreamId] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [duration, setDuration] = useState('');
  const [freePreview, setFreePreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addMut = useMutation({
    mutationFn: () => adminApi.products.lessons.create(productId, {
      title: title.trim(),
      description: description.trim() || undefined,
      content: stripHtml(content) ? content : undefined,
      videoStreamId: videoStreamId || undefined,
      streamStatus: videoStreamId ? (streamStatus || 'ready') : undefined,
      videoUrl: videoStreamId ? undefined : (videoKey ? undefined : (videoUrl.trim() || undefined)),
      videoKey: videoStreamId ? undefined : (videoKey || undefined),
      durationSec: parseDurationToSec(duration),
      isFreePreview: freePreview,
      moduleId: moduleId,
    }),
    onSuccess: () => {
      toast.success('Хичээл нэмэгдлээ');
      onAdded();
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/10">
      <p className="text-xs font-semibold text-muted-foreground">{lessonCount + 1}-р хичээл</p>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Хичээлийн гарчиг *" className="h-8 text-sm" autoFocus />
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Богино тайлбар (жагсаалтад)</p>
        <RichEditor value={description} onChange={setDescription} placeholder="Хичээлийн товч тайлбар (заавал биш)" minHeight="60px" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Хичээлийн агуулга (дэлгэрэнгүй тэмдэглэл)</p>
        <RichEditor value={content} onChange={setContent} placeholder="Дэлгэрэнгүй тэмдэглэл, код, зураг — суралцагчид видеоны доор харагдана (заавал биш)" minHeight="100px" />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
        <VideoUploadInput
          productId={productId}
          videoUrl={videoUrl} setVideoUrl={setVideoUrl}
          videoKey={videoKey} setVideoKey={setVideoKey}
          videoStreamId={videoStreamId} setVideoStreamId={setVideoStreamId}
          setStreamStatus={setStreamStatus}
          duration={duration} setDuration={setDuration}
          onUploadingChange={setUploading}
        />
        <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="мм:сс" className="h-7 text-xs w-24" />
      </div>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <Paperclip className="h-2.5 w-2.5 shrink-0" /> Хавсралт / татах материалыг хичээл нэмсний дараа засварлах товчоор оруулна.
      </p>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={freePreview} onChange={(e) => setFreePreview(e.target.checked)} />
          <span>Үнэгүй урьдчилсан харагдах</span>
        </label>
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs px-2.5 gap-1" onClick={() => addMut.mutate()} disabled={!title.trim() || addMut.isPending || uploading}>
            <Plus className="h-3 w-3" />{uploading ? 'Байршуулж байна...' : addMut.isPending ? '...' : 'Нэмэх'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onCancel}>Болих</Button>
        </div>
      </div>
    </div>
  );
}

// ── Хичээлийн жагсаалт — drag-drop эрэмбэлэлт (up/down товчтой зэрэгцэн) ──────
function SortableLessonList({
  lessons,
  productId,
  onMoved,
  onDeleted,
  onUpdated,
  onReorder,
}: {
  lessons: AdminLesson[];
  productId: string;
  onMoved: (lesson: AdminLesson, dir: 'up' | 'down') => void;
  onDeleted: (lessonId: string) => void;
  onUpdated: (updated: AdminLesson) => void;
  onReorder: (ordered: AdminLesson[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Шинэ дараалал үүсгэх
    const reordered = [...lessons];
    const [moved] = reordered.splice(oldIndex, 1);
    if (!moved) return;
    reordered.splice(newIndex, 0, moved);

    // Эх sortOrder утгуудыг (өсөх дарааллаар) дахин хуваарилна
    const sortValues = lessons.map((l) => l.sortOrder).sort((a, b) => a - b);
    const items = reordered.map((l, i) => ({ id: l.id, sortOrder: sortValues[i] ?? i }));

    // Optimistic: эцэг компонент шууд шинэ дарааллыг харуулна
    onReorder(reordered.map((l, i) => ({ ...l, sortOrder: sortValues[i] ?? i })));

    adminApi.products.lessons
      .reorder(productId, items)
      .catch(() => toast.error('Эрэмбэлэхэд алдаа гарлаа'));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-border/50">
          {lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={i}
              total={lessons.length}
              productId={productId}
              onMoved={(dir) => onMoved(lesson, dir)}
              onDeleted={() => onDeleted(lesson.id)}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Module section with its lessons ──────────────────────────────────────────
function ModuleSection({
  mod,
  productId,
  allLessons,
  onInvalidate,
}: {
  mod: AdminCourseModule;
  productId: string;
  allLessons: AdminLesson[];
  onInvalidate: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(mod.title);
  const [addingLesson, setAddingLesson] = useState(false);

  const lessons = mod.lessons;

  const saveTitleMut = useMutation({
    mutationFn: () => adminApi.products.modules.update(productId, mod.id, { title: titleValue.trim() }),
    onSuccess: () => { setEditingTitle(false); onInvalidate(); toast.success('Модуль шинэчлэгдлээ'); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminApi.products.modules.remove(productId, mod.id),
    onSuccess: () => { onInvalidate(); toast.success('Модуль устгагдлаа'); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const deleteLessonMut = useMutation({
    mutationFn: (lessonId: string) => adminApi.products.lessons.remove(productId, lessonId),
    onSuccess: () => { onInvalidate(); toast.success('Устгагдлаа'); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  function handleMoveLesson(lesson: AdminLesson, dir: 'up' | 'down') {
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lessons.length) return;
    adminApi.products.lessons.reorder(productId, [
      { id: lessons[idx]!.id, sortOrder: lessons[swapIdx]!.sortOrder },
      { id: lessons[swapIdx]!.id, sortOrder: lessons[idx]!.sortOrder },
    ]).then(onInvalidate);
  }

  const totalSec = lessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const totalLabel = totalSec > 0 ? formatDurationLabel(totalSec) : null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Module header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border-b border-border">
        <button type="button" onClick={() => setOpen((p) => !p)} className="shrink-0">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        <FolderOpen className="h-4 w-4 text-primary shrink-0" />

        {editingTitle ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              className="h-7 text-sm flex-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveTitleMut.mutate(); if (e.key === 'Escape') setEditingTitle(false); }}
            />
            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => saveTitleMut.mutate()} disabled={!titleValue.trim() || saveTitleMut.isPending}>
              {saveTitleMut.isPending ? '...' : 'OK'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setTitleValue(mod.title); setEditingTitle(false); }}>X</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{mod.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {lessons.length} хичээл{totalLabel ? ` · ${totalLabel}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTitle(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => { if (confirm(`"${mod.title}" модулийг устгах уу? Хичээлүүд нь модульгүй болно.`)) deleteMut.mutate(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Lesson list */}
      {open && (
        <div className="divide-y divide-border/50">
          <SortableLessonList
            lessons={lessons}
            productId={productId}
            onMoved={handleMoveLesson}
            onDeleted={(lessonId) => deleteLessonMut.mutate(lessonId)}
            onReorder={(ordered) => {
              queryClient.setQueryData<AdminCourseModule[]>(
                ['admin', 'products', productId, 'modules'],
                (old) => old?.map((m) => m.id === mod.id ? { ...m, lessons: ordered } : m) ?? old,
              );
            }}
            onUpdated={(updated) => {
              queryClient.setQueryData<AdminCourseModule[]>(
                ['admin', 'products', productId, 'modules'],
                (old) => old?.map((m) => m.id === mod.id
                  ? { ...m, lessons: m.lessons.map((l) => l.id === updated.id ? updated : l) }
                  : m,
                ) ?? old,
              );
            }}
          />

          {/* Add lesson inside module */}
          <div className="px-3 py-2.5 bg-muted/10">
            {addingLesson ? (
              <AddLessonForm
                productId={productId}
                moduleId={mod.id}
                lessonCount={lessons.length}
                onAdded={() => { setAddingLesson(false); onInvalidate(); }}
                onCancel={() => setAddingLesson(false)}
              />
            ) : (
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setAddingLesson(true)}>
                <Plus className="h-3.5 w-3.5" />
                Хичээл нэмэх
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CourseTab({ productId }: { productId?: string }) {
  const queryClient = useQueryClient();
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'modules'],
    queryFn: () => adminApi.products.modules.list(productId!),
    enabled: !!productId,
  });

  const { data: allLessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'lessons'],
    queryFn: () => adminApi.products.lessons.list(productId!),
    enabled: !!productId,
  });

  const invalidateModules = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'modules'] });
  const invalidateLessons = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'lessons'] });
  const invalidateAll = () => { invalidateModules(); invalidateLessons(); };

  // Lessons with no module
  const ungroupedLessons = allLessons.filter((l) => !l.moduleId);

  const totalLessons = allLessons.length;
  const totalSec = allLessons.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
  const totalLabel = totalSec > 0 ? formatDurationLabel(totalSec) : null;

  const addModuleMut = useMutation({
    mutationFn: () => adminApi.products.modules.create(productId!, { title: newModuleTitle.trim(), sortOrder: modules.length }),
    onSuccess: () => { toast.success('Модуль нэмэгдлээ'); setNewModuleTitle(''); setAddingModule(false); invalidateModules(); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const deleteUngroupedMut = useMutation({
    mutationFn: (lessonId: string) => adminApi.products.lessons.remove(productId!, lessonId),
    onSuccess: () => { toast.success('Устгагдлаа'); invalidateLessons(); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  function handleMoveUngrouped(lesson: AdminLesson, dir: 'up' | 'down') {
    const idx = ungroupedLessons.findIndex((l) => l.id === lesson.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ungroupedLessons.length) return;
    adminApi.products.lessons.reorder(productId!, [
      { id: ungroupedLessons[idx]!.id, sortOrder: ungroupedLessons[swapIdx]!.sortOrder },
      { id: ungroupedLessons[swapIdx]!.id, sortOrder: ungroupedLessons[idx]!.sortOrder },
    ]).then(invalidateLessons);
  }

  if (!productId) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Бүтээгдэхүүнийг хадгалсны дараа хичээл нэмнэ үү.
      </div>
    );
  }

  if (modulesLoading || lessonsLoading) return <p className="text-sm text-muted-foreground py-4">Ачаалж байна...</p>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {totalLessons > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-semibold">{totalLessons}</span>
            <span className="text-muted-foreground">хичээл</span>
          </div>
          {modules.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-semibold">{modules.length}</span>
              <span className="text-muted-foreground">модуль</span>
            </div>
          )}
          {totalLabel && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold">{totalLabel}</span>
              <span className="text-muted-foreground">нийт</span>
            </div>
          )}
        </div>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod) => (
          <ModuleSection
            key={mod.id}
            mod={mod}
            productId={productId}
            allLessons={allLessons}
            onInvalidate={invalidateAll}
          />
        ))}
      </div>

      {/* Add module form */}
      {addingModule ? (
        <div className="rounded-lg border border-dashed border-primary/40 p-3 space-y-2 bg-primary/5">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Шинэ модуль
          </p>
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Модулийн нэр жишээ нь: Эхлэл хичээлүүд"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') addModuleMut.mutate(); if (e.key === 'Escape') setAddingModule(false); }}
          />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" className="h-7 text-xs px-3" onClick={() => addModuleMut.mutate()} disabled={!newModuleTitle.trim() || addModuleMut.isPending}>
              {addModuleMut.isPending ? '...' : 'Нэмэх'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setAddingModule(false); setNewModuleTitle(''); }}>Болих</Button>
          </div>
        </div>
      ) : null}

      {/* Ungrouped lessons section */}
      {(ungroupedLessons.length > 0 || modules.length === 0) && (
        <div className="rounded-xl border border-border overflow-hidden">
          {modules.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">Модульгүй хичээлүүд</p>
            </div>
          )}
          <div className="divide-y divide-border/50">
            <SortableLessonList
              lessons={ungroupedLessons}
              productId={productId}
              onMoved={handleMoveUngrouped}
              onDeleted={(lessonId) => deleteUngroupedMut.mutate(lessonId)}
              onReorder={(ordered) => {
                // ungrouped хичээлүүдийн шинэ дарааллыг бусад (module-тай) хичээлтэй нэгтгэнэ
                queryClient.setQueryData<AdminLesson[]>(
                  ['admin', 'products', productId, 'lessons'],
                  (old) => {
                    if (!old) return old;
                    const others = old.filter((l) => l.moduleId);
                    return [...ordered, ...others];
                  },
                );
              }}
              onUpdated={(updated) => {
                queryClient.setQueryData<AdminLesson[]>(
                  ['admin', 'products', productId, 'lessons'],
                  (old) => old?.map((l) => l.id === updated.id ? updated : l) ?? old,
                );
              }}
            />
            <div className="px-3 py-2.5 bg-muted/10">
              {addingLesson ? (
                <AddLessonForm
                  productId={productId}
                  lessonCount={ungroupedLessons.length}
                  onAdded={() => { setAddingLesson(false); invalidateLessons(); }}
                  onCancel={() => setAddingLesson(false)}
                />
              ) : (
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setAddingLesson(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Хичээл нэмэх
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={() => setAddingModule(true)} disabled={addingModule}>
          <FolderPlus className="h-4 w-4" />
          Модуль нэмэх
        </Button>
        {modules.length === 0 && !addingLesson && (
          <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={() => setAddingLesson(true)}>
            <Plus className="h-4 w-4" />
            Хичээл нэмэх
          </Button>
        )}
      </div>
    </div>
  );
}

function FilesTab({ productId, product: productProp }: { productId?: string; product?: AdminProduct | null }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const downloadFileRef = useRef<HTMLInputElement>(null);
  const bundleFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const bundleDownloadFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadingDownloadFile, setUploadingDownloadFile] = useState(false);
  const [bundleUploading, setBundleUploading] = useState<Record<string, boolean>>({});
  const [bundleDownloadUploading, setBundleDownloadUploading] = useState<Record<string, boolean>>({});
  const [openFileBundles, setOpenFileBundles] = useState<Record<string, boolean>>({});
  const toggleFileBundle = (id: string) => setOpenFileBundles((p) => ({ ...p, [id]: p[id] !== true }));
  const isFileBundleOpen = (id: string) => openFileBundles[id] === true;

  // downloadFileKey зэрэг шинэчлэгдэх талбарыг prop-оос биш өөрийн query-аар уншина —
  // invalidateProduct() хийгдэхэд энэ query шууд refetch болж UI шинэчлэгдэнэ
  const { data: productFresh } = useQuery({
    queryKey: ['admin', 'products', productId],
    queryFn: () => adminApi.products.get(productId!),
    enabled: !!productId,
  });
  const product = productFresh ?? productProp;

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'files'],
    queryFn: () => adminApi.products.files.list(productId!),
    enabled: !!productId,
  });

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'bundles'],
    queryFn: () => adminApi.bundles.list(productId!),
    enabled: !!productId,
  });

  // bundle item fileIds нь өөр product-ийн файл байж болох тул тусдаа query-аар татна
  const allBundleFileIds = (bundles as AdminBundle[]).flatMap((b) => b.items.flatMap((i) => i.fileIds ?? []));
  const { data: bundleLinkedFiles = [] } = useQuery({
    queryKey: ['admin', 'files', 'by-ids', allBundleFileIds],
    queryFn: () => adminApi.files.byIds(allBundleFileIds),
    enabled: allBundleFileIds.length > 0,
  });

  const invalidateFiles = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'files'] });
  const invalidateBundles = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'bundles'] });
  const invalidateProduct = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
  const invalidateAll = () => { invalidateFiles(); invalidateBundles(); };

  async function handleDownloadFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!productId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDownloadFile(true);
    try {
      const r = await uploadFileWithToast(file);
      await adminApi.products.files.setDownloadFile(productId, r.key);
      toast.success('Татах файл тохируулагдлаа');
      invalidateProduct();
    } catch { toast.error('Алдаа гарлаа'); }
    finally { setUploadingDownloadFile(false); if (downloadFileRef.current) downloadFileRef.current.value = ''; }
  }

  async function handleBundleDownloadFileSelect(e: React.ChangeEvent<HTMLInputElement>, bundleId: string) {
    if (!productId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setBundleDownloadUploading((p) => ({ ...p, [bundleId]: true }));
    try {
      const r = await uploadFileWithToast(file);
      await adminApi.bundles.setDownloadFile(productId, bundleId, r.key);
      toast.success('Бүлгийн татах файл тохируулагдлаа');
      invalidateBundles();
    } catch { toast.error('Алдаа гарлаа'); }
    finally {
      setBundleDownloadUploading((p) => ({ ...p, [bundleId]: false }));
      const ref = bundleDownloadFileRefs.current[bundleId];
      if (ref) ref.value = '';
    }
  }

  const removeMut = useMutation({
    mutationFn: (fileId: string) => adminApi.products.files.remove(productId!, fileId),
    onSuccess: () => { toast.success('Устгагдлаа'); invalidateFiles(); },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const removeItemFileMut = useMutation({
    mutationFn: ({ bundleId, itemId, newFileIds }: { bundleId: string; itemId: string; newFileIds: string[] }) =>
      adminApi.bundles.updateItem(productId!, bundleId, itemId, { fileIds: newFileIds }),
    onSuccess: () => invalidateAll(),
  });

  const linkExistingFileMut = useMutation({
    mutationFn: ({ bundleId, itemId, fileId, currentIds }: { bundleId: string; itemId: string; fileId: string; currentIds: string[] }) =>
      adminApi.bundles.updateItem(productId!, bundleId, itemId, { fileIds: [...currentIds, fileId] }),
    onSuccess: () => invalidateAll(),
  });

  function formatSize(bytes?: number | null) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleGlobalFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!productId) { toast.info('Эхлээд бүтээгдэхүүнийг хадгалж, дараа файл нэмнэ үү'); return; }
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setUploading(true);
    try {
      // Дараалан upload — том файлуудын progress toast зөрчихгүй
      for (const file of picked) {
        const r = await uploadFileWithToast(file);
        await adminApi.products.files.add(productId, { fileKey: r.key, fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size });
      }
      if (picked.length > 1) toast.success(`${picked.length} файл нэмэгдлээ`);
      invalidateFiles();
    } catch { toast.error('Файл ачаалахад алдаа гарлаа'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleBundleFileSelect(e: React.ChangeEvent<HTMLInputElement>, bundleId: string, item: AdminBundleItem) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length || !productId) return;
    setBundleUploading((p) => ({ ...p, [item.id]: true }));
    try {
      const newIds: string[] = [];
      for (const file of picked) {
        const r = await uploadFileWithToast(file);
        const added = await adminApi.products.files.add(productId, { fileKey: r.key, fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size });
        newIds.push(added.id);
      }
      const currentIds = item.fileIds ?? [];
      await adminApi.bundles.updateItem(productId, bundleId, item.id, { fileIds: [...currentIds, ...newIds] });
      toast.success(`${picked.length} файл холбогдлоо`);
      invalidateAll();
    } catch { toast.error('Алдаа гарлаа'); }
    finally {
      setBundleUploading((p) => ({ ...p, [item.id]: false }));
      const ref = bundleFileRefs.current[item.id];
      if (ref) ref.value = '';
    }
  }

  if (filesLoading || bundlesLoading) return <p className="text-sm text-muted-foreground py-4">Ачаалж байна...</p>;

  const allLinkedFileIds = new Set(
    bundles.flatMap((b: AdminBundle) => b.items.flatMap((i: AdminBundleItem) => i.fileIds ?? [])),
  );
  const unlinkedFiles = (files as AdminProductFile[]).filter((f) => !allLinkedFileIds.has(f.id));

  return (
    <div className="space-y-5">
      {/* ── Product "Бүгдийг татах" файл ── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 border-b border-border">
          <Download className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold flex-1">Бүгдийг татах файл</span>
          <span className="text-xs text-muted-foreground">Хэрэглэгч "Бүгдийг татах" дарахад энэ файл татагдана</span>
        </div>
        <div className="p-3 space-y-2">
          {product?.downloadFileKey ? (
            <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/15 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs flex-1 truncate font-medium text-muted-foreground">{product.downloadFileKey.split('/').pop()}</span>
              <Button
                type="button" size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0"
                onClick={() => downloadFileRef.current?.click()}
                disabled={uploadingDownloadFile}
              >
                {uploadingDownloadFile ? 'Ачаалж байна...' : 'Солих'}
              </Button>
              <Button
                type="button" size="icon" variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                onClick={async () => {
                  await adminApi.products.files.setDownloadFile(productId!, null);
                  invalidateProduct();
                  toast.success('Устгагдлаа');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors ${productId ? 'cursor-pointer hover:border-primary/40' : 'opacity-50 cursor-not-allowed'}`}
              onClick={() => productId ? downloadFileRef.current?.click() : toast.info('Эхлээд хадгалж, дараа файл нэмнэ үү')}
            >
              <Upload className="h-4 w-4" />
              <span className="text-xs">{uploadingDownloadFile ? 'Ачаалж байна...' : 'ZIP эсвэл дурын файл upload хийх'}</span>
            </div>
          )}
          <input ref={downloadFileRef} type="file" className="hidden" onChange={handleDownloadFileSelect} disabled={uploadingDownloadFile || !productId} />
          {/* Байгаа файлаас сонгож холбох — дахин upload-гүй (cloud зай хэмнэнэ) */}
          {(() => {
            const all = [...(files as AdminProductFile[]), ...(bundleLinkedFiles as AdminProductFile[])];
            const seen = new Set<string>();
            const dd = all.filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
            if (!productId || !dd.length) return null;
            return (
              <select
                className="h-7 w-full rounded-md border border-border bg-background text-xs px-2 text-muted-foreground"
                value=""
                onChange={async (e) => {
                  const f = dd.find((x) => x.id === e.target.value);
                  if (!f) return;
                  await adminApi.products.files.setDownloadFile(productId, f.fileKey);
                  invalidateProduct();
                  toast.success('Татах файл холбогдлоо');
                }}
              >
                <option value="">— Бүгдийг татах файлыг байгаагаас сонгох ({dd.length}) —</option>
                {dd.map((f) => (
                  <option key={f.id} value={f.id}>{f.fileName}</option>
                ))}
              </select>
            );
          })()}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Бүлэг бүрийн зүйл бүрд нэг буюу хэд хэдэн файл холбоно. Бүлэгт хамааргүй ерөнхий файлуудыг доорх хэсэгт нэмнэ үү.
      </div>

      {/* Bundle-linked files */}
      {bundles.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Бүлгийн файлууд</p>
          {(bundles as AdminBundle[]).map((bundle, bi) => (
            <div key={bundle.id} className="rounded-lg border border-border overflow-hidden">
              <div
                className="flex items-center gap-2 bg-muted/40 px-3 py-2 hover:bg-muted/60 transition-colors cursor-pointer"
                onClick={() => toggleFileBundle(bundle.id)}
              >
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isFileBundleOpen(bundle.id) ? '' : '-rotate-90'}`} />
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold flex-1">{bi + 1}. {bundle.title}</span>
                <span className="text-xs text-muted-foreground">{bundle.items.length} зүйл</span>
                {/* Bundle download file upload */}
                <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  {bundle.downloadFileKey ? (
                    <>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Татах файл
                      </span>
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="h-6 text-xs px-1.5 text-muted-foreground hover:text-primary"
                        onClick={() => bundleDownloadFileRefs.current[bundle.id]?.click()}
                        disabled={bundleDownloadUploading[bundle.id]}
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button" size="icon" variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={async () => {
                          await adminApi.bundles.setDownloadFile(productId!, bundle.id, null);
                          invalidateBundles();
                          toast.success('Устгагдлаа');
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1" title="Бүлгийн ZIP файл оруулаагүй бол сайтад 'Бүлгээр татах' товч ХАРАГДАХГҮЙ">
                        <AlertTriangle className="h-3 w-3" /> ZIP заавал
                      </span>
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-6 text-xs px-2 gap-1"
                        onClick={() => bundleDownloadFileRefs.current[bundle.id]?.click()}
                        disabled={bundleDownloadUploading[bundle.id]}
                      >
                        <Upload className="h-3 w-3" />
                        {bundleDownloadUploading[bundle.id] ? 'Ачаалж байна...' : 'Татах файл'}
                      </Button>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    ref={(el) => { bundleDownloadFileRefs.current[bundle.id] = el; }}
                    onChange={(e) => handleBundleDownloadFileSelect(e, bundle.id)}
                  />
                </span>
              </div>
              {isFileBundleOpen(bundle.id) && <div className="divide-y divide-border">
                {/* Бүлгийн "Татах файл"-ыг байгаа файлаас сонгож холбох (дахин upload-гүй) */}
                {(() => {
                  const all = [...(files as AdminProductFile[]), ...(bundleLinkedFiles as AdminProductFile[])];
                  const seen = new Set<string>();
                  const dd = all.filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
                  if (!dd.length) return null;
                  return (
                    <div className="px-3 py-2 bg-muted/20">
                      <select
                        className="h-7 w-full rounded-md border border-border bg-background text-xs px-2 text-muted-foreground"
                        value=""
                        onChange={async (e) => {
                          const f = dd.find((x) => x.id === e.target.value);
                          if (!f) return;
                          await adminApi.bundles.setDownloadFile(productId!, bundle.id, f.fileKey);
                          invalidateBundles();
                          toast.success('Татах файл холбогдлоо');
                        }}
                      >
                        <option value="">— Бүлгийн татах файлыг байгаагаас сонгох ({dd.length}) —</option>
                        {dd.map((f) => (
                          <option key={f.id} value={f.id}>{f.fileName}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                {bundle.items.map((item: AdminBundleItem) => {
                  const itemFileIds = item.fileIds ?? [];
                  const allKnownFiles = [...(files as AdminProductFile[]), ...(bundleLinkedFiles as AdminProductFile[])];
                  const seen = new Set<string>();
                  const deduped = allKnownFiles.filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
                  const linkedFiles = itemFileIds
                    .map((fid) => deduped.find((f) => f.id === fid))
                    .filter(Boolean) as AdminProductFile[];

                  return (
                    <div key={item.id} className="px-3 py-2.5 space-y-2">
                      {/* Item header */}
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1">{item.name}</span>
                        {bundleUploading[item.id] && (
                          <span className="text-xs text-muted-foreground animate-pulse">Ачаалж байна...</span>
                        )}
                        {/* Upload more files */}
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors shrink-0"
                          onClick={() => bundleFileRefs.current[item.id]?.click()}
                          disabled={bundleUploading[item.id]}
                        >
                          <Upload className="h-3 w-3" />
                          Файл нэмэх
                        </button>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          ref={(el) => { bundleFileRefs.current[item.id] = el; }}
                          onChange={(e) => handleBundleFileSelect(e, bundle.id, item)}
                        />
                      </div>

                      {/* Linked files list */}
                      {linkedFiles.length > 0 && (
                        <div className="ml-5 space-y-1">
                          {linkedFiles.map((lf) => (
                            <div key={lf.id} className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/15 px-2 py-1.5">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="text-xs flex-1 truncate font-medium">{lf.fileName}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{formatSize(lf.sizeBytes)}</span>
                              <Button
                                type="button" size="icon" variant="ghost"
                                className="h-5 w-5 text-destructive hover:text-destructive shrink-0"
                                onClick={() => removeItemFileMut.mutate({
                                  bundleId: bundle.id,
                                  itemId: item.id,
                                  newFileIds: itemFileIds.filter((id) => id !== lf.id),
                                })}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Байгаа файлаас холбох — энэ product дээр аль хэдийн оруулсан
                          БҮХ файлаас (flat product files + бусад bundle item-д
                          холбосон файлууд = deduped) сонгож дахин холбоно. Ингэснээр
                          нэг файлыг олон газар дахин upload хийхгүй (cloud зай хэмнэнэ). */}
                      {(() => {
                        const availableForItem = deduped.filter((f) => !itemFileIds.includes(f.id));
                        if (!availableForItem.length) return null;
                        return (
                          <div className="ml-5">
                            <select
                              className="h-7 w-full rounded-md border border-border bg-background text-xs px-2 text-muted-foreground"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) linkExistingFileMut.mutate({ bundleId: bundle.id, itemId: item.id, fileId: e.target.value, currentIds: itemFileIds });
                              }}
                            >
                              <option value="">— байгаа файлаас сонгож холбох ({availableForItem.length}) —</option>
                              {availableForItem.map((f) => (
                                <option key={f.id} value={f.id}>{f.fileName}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>}
            </div>
          ))}
        </div>
      )}

      {/* Unlinked / general files */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ерөнхий файлууд</p>
        {unlinkedFiles.length > 0 && (
          <div className="space-y-1.5">
            {unlinkedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-primary/60" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.fileName}</p>
                  {(file.sizeBytes || file.mimeType) && (
                    <p className="text-xs text-muted-foreground">{[file.mimeType, formatSize(file.sizeBytes)].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <Button
                  type="button" size="icon" variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => { if (confirm('Файл устгах уу?')) removeMut.mutate(file.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div
          className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors ${productId ? 'cursor-pointer hover:border-primary/40' : 'opacity-50 cursor-not-allowed'}`}
          onClick={() => productId ? fileRef.current?.click() : toast.info('Эхлээд бүтээгдэхүүнийг хадгалж, дараа файл нэмнэ үү')}
        >
          <Upload className="h-4 w-4" />
          <span className="text-xs">{uploading ? 'Ачаалж байна...' : productId ? 'Файл нэмэх' : 'Хадгалсны дараа нэмнэ үү'}</span>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleGlobalFileSelect} disabled={uploading || !productId} />
      </div>
    </div>
  );
}

type PendingMedia = { file: File; preview: string | null; id: string; type: 'image' | 'video' };

function PendingVideoPreview({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return null;
  return (
    <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" controls />
  );
}

function InlineMediaManager({
  productId,
  pendingFiles,
  onPendingFilesChange,
}: {
  productId?: string;
  pendingFiles: PendingMedia[];
  onPendingFilesChange: (items: PendingMedia[]) => void;
}) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: existingImages = [], isLoading } = useQuery({
    queryKey: ['admin', 'products', productId, 'images'],
    queryFn: () => adminApi.products.images.list(productId!),
    enabled: !!productId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId, 'images'] });

  const removeMut = useMutation({
    mutationFn: (imageId: string) => adminApi.products.images.remove(productId!, imageId),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const setPrimaryMut = useMutation({
    mutationFn: (imageId: string) => adminApi.products.images.update(productId!, imageId, { isPrimary: true }),
    onSuccess: () => invalidate(),
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    if (productId) {
      setUploading(true);
      try {
        // Дараалан upload хийж progress toast-г зөрчихгүй байлгана
        const uploaded: { file: File; r: Awaited<ReturnType<typeof uploadFileWithToast>> }[] = [];
        for (const file of files) {
          const r = await uploadFileWithToast(file);
          uploaded.push({ file, r });
        }
        // DB-д дарааллаар insert хийж sortOrder race-г арилгана
        for (let i = 0; i < uploaded.length; i++) {
          const { file, r } = uploaded[i];
          if (file.type.startsWith('video/')) {
            await adminApi.products.images.addVideo(productId, r.thumbnailUrl ?? r.url);
          } else {
            const isFirst = existingImages.length === 0 && i === 0;
            const variantPayload = r.variantData?.map((v) => ({
              size: v.size,
              fileKey: v.key,
              width: v.width,
              height: v.height,
              bytes: v.bytes,
            }));
            await adminApi.products.images.addImage(productId, r.key, file.name, isFirst, variantPayload);
          }
        }
        toast.success(`${files.length} файл нэмэгдлээ`);
        invalidate();
      } catch {
        toast.error('Файл ачаалахад алдаа гарлаа');
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    } else {
      const newItems = await Promise.all(
        files.map(
          (file) =>
            new Promise<PendingMedia>((resolve) => {
              const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
              if (type === 'image') {
                const reader = new FileReader();
                reader.onload = (ev) =>
                  resolve({ file, preview: ev.target?.result as string, id: Math.random().toString(36).slice(2), type });
                reader.readAsDataURL(file);
              } else {
                resolve({ file, preview: null, id: Math.random().toString(36).slice(2), type });
              }
            }),
        ),
      );
      onPendingFilesChange([...pendingFiles, ...newItems]);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (productId && isLoading) return <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">Ачаалж байна...</div>;

  const hasItems = existingImages.length > 0 || pendingFiles.length > 0;

  return (
    <div className="space-y-3">
      {hasItems ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {existingImages.map((img: AdminProductImage) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {img.videoUrl ? (
                <div className="relative h-full w-full bg-black">
                  <video
                    src={img.videoUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    controls
                  />
                  <button
                    type="button"
                    onClick={() => removeMut.mutate(img.id)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600/80"
                    title="Устгах"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}
              {img.isPrimary && (
                <div className="absolute left-1 top-1">
                  <span className="flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    <Star className="h-2.5 w-2.5 fill-current" /> Үндсэн
                  </span>
                </div>
              )}
              {!img.videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {!img.isPrimary && (
                    <button type="button" onClick={() => setPrimaryMut.mutate(img.id)}
                      className="rounded-full bg-white/20 p-1.5 hover:bg-white/40 transition-colors" title="Үндсэн болгох">
                      <Star className="h-3.5 w-3.5 text-white" />
                    </button>
                  )}
                  <button type="button" onClick={() => removeMut.mutate(img.id)}
                    className="rounded-full bg-white/20 p-1.5 hover:bg-red-500/80 transition-colors" title="Устгах">
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {pendingFiles.map((item, i) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {item.type === 'video' ? (
                <div className="relative h-full w-full bg-black">
                  <PendingVideoPreview file={item.file} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview!} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              )}
              {i === 0 && existingImages.length === 0 && item.type === 'image' && (
                <div className="absolute left-1 top-1">
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">Үндсэн</span>
                </div>
              )}
              <button type="button"
                onClick={() => onPendingFilesChange(pendingFiles.filter((f) => f.id !== item.id))}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <Upload className="h-5 w-5" />
            {uploading ? 'Ачаалж...' : 'Нэмэх'}
          </button>
        </div>
      ) : (
        <div
          className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground hover:border-primary/40 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-6 w-6" />
          <span>{uploading ? 'Ачаалж байна...' : 'Зураг / Видео оруулах'}</span>
          <span className="text-xs opacity-60">image/*, video/*</span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} />
    </div>
  );
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [generating, setGenerating] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingMedia[]>([]);
  const [savedProduct, setSavedProduct] = useState<AdminProduct | null>(null);
  const effectiveProduct = product ?? savedProduct;
  // Incrementing this key forces all RichEditors to remount with fresh content
  const [editorResetToken, setEditorResetToken] = useState(0);

  // FAQ / Testimonial selections — state in parent so tab switches don't lose them
  const [selectedFaqIds, setSelectedFaqIds] = useState<Set<string>>(new Set());
  const [selectedTestimonialIds, setSelectedTestimonialIds] = useState<Set<string>>(new Set());
  // Сүүлийн удаа аль product.id-д зориулж init хийсэн — давхар init-ээс хамгаалдаг
  const faqIdsInitializedFor = useRef<string | null>(null);
  const testimonialIdsInitializedFor = useRef<string | null>(null);

  const proofImgRef = useRef<HTMLInputElement>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi.categories.list(),
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['admin', 'ai-status'],
    queryFn: () => adminApi.products.aiStatus(),
    staleTime: 60 * 1000,
  });
  const aiEnabled = aiStatus?.enabled ?? false;

  const { data: productTypeConfigs = [] } = useQuery({
    queryKey: ['admin', 'product-types'],
    queryFn: () => adminApi.productTypes.list(),
    staleTime: 5 * 60 * 1000,
  });
  const productTypes: { value: string; label: string }[] =
    productTypeConfigs.filter((t) => t.active).map((t) => ({ value: t.value, label: t.label }));

  const { data: assignedFaqIds } = useQuery({
    queryKey: ['admin', 'products', product?.id, 'faq-ids'],
    queryFn: () => adminApi.products.getFaqIds(product!.id),
    enabled: !!product?.id && open,
    staleTime: 0,
  });

  const { data: assignedTestimonialIds } = useQuery({
    queryKey: ['admin', 'products', product?.id, 'testimonial-ids'],
    queryFn: () => adminApi.products.getTestimonialIds(product!.id),
    enabled: !!product?.id && open,
    staleTime: 0,
  });

  // Holds the data returned from the last successful save — avoids stale list data on re-open
  const justSavedRef = useRef<AdminProduct | null>(null);
  // Tracks which product.id was used to initialize the form (prevents double-init)
  const initializedForRef = useRef<string | null>(null);

  function buildFormFromProduct(p: AdminProduct) {
    const catIds = (p as any).categoryIds as string[] | undefined;
    const effectiveCategoryIds = catIds && catIds.length > 0
      ? catIds
      : p.categoryId ? [p.categoryId] : [];
    return {
      title: p.title,
      slug: p.slug,
      description: p.description,
      price: String(p.price),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
      type: p.type,
      types: p.type ? [p.type] : [],
      categoryId: p.categoryId ?? '',
      categoryIds: effectiveCategoryIds,
      published: p.published,
      featured: p.featured,
      seoTitle: p.seoTitle ?? '',
      seoDescription: p.seoDescription ?? '',
      howToUse: p.howToUse ?? DEFAULT_HOW_TO_USE,
      whatsIncluded: p.whatsIncluded ?? '',
      discountEndsAt: p.discountEndsAt ? p.discountEndsAt.slice(0, 16) : '',
      howToUseSteps: Array.isArray(p.howToUseSteps) && (p.howToUseSteps as any[]).length > 0
        ? (p.howToUseSteps as any[]).map((s: any) => ({
            title: String(s?.title ?? ''),
            description: String(s?.description ?? ''),
          }))
        : [...DEFAULT_HOW_TO_USE_STEPS],
      rating: String(p.rating ?? 0),
      ratingCount: String(p.ratingCount ?? 0),
      proofImageUrl: p.proofImageUrl ?? '',
      proofQuote: p.proofQuote ?? '',
      proofText: p.proofText ?? '',
      proofAuthorName: p.proofAuthorName ?? '',
      proofAuthorRole: p.proofAuthorRole ?? '',
    };
  }

  // Initialize form when dialog opens
  useEffect(() => {
    if (!open) {
      initializedForRef.current = null;
      faqIdsInitializedFor.current = null;
      testimonialIdsInitializedFor.current = null;
      setSelectedFaqIds(new Set());
      setSelectedTestimonialIds(new Set());
      setSavedProduct(null);
      // Dialog хаагдах үед FAQ/testimonial cache-г устгана — дараагийн нээлтэд server-ээс fresh fetch хийнэ
      if (product?.id) {
        queryClient.removeQueries({ queryKey: ['admin', 'products', product.id, 'faq-ids'] });
        queryClient.removeQueries({ queryKey: ['admin', 'products', product.id, 'testimonial-ids'] });
      }
      return;
    }

    if (product) {
      const hasSaved = justSavedRef.current?.id === product.id;
      const source = hasSaved ? justSavedRef.current! : product;
      if (hasSaved) justSavedRef.current = null;

      if (initializedForRef.current === product.id) return;
      initializedForRef.current = product.id;
      // FAQ/testimonial refs-ийг энд reset хийх — open болоход шинэ data-г дахин ачаалах
      faqIdsInitializedFor.current = null;
      testimonialIdsInitializedFor.current = null;
      setEditorResetToken((t) => t + 1);
      setForm(buildFormFromProduct(source));
    } else {
      if (initializedForRef.current === 'new') return;
      initializedForRef.current = 'new';
      faqIdsInitializedFor.current = null;
      testimonialIdsInitializedFor.current = null;
      setEditorResetToken((t) => t + 1);
      const firstType = productTypes[0]?.value ?? '';
      setForm({ ...emptyForm, type: firstType, types: firstType ? [firstType] : [] });
      setPendingFiles([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, open]);

  // Initialize FAQ selections from server data
  useEffect(() => {
    if (!product?.id) return;
    if (faqIdsInitializedFor.current === product.id) return;
    if (assignedFaqIds === undefined) return;
    faqIdsInitializedFor.current = product.id;
    setSelectedFaqIds(new Set(assignedFaqIds));
  }, [assignedFaqIds, product?.id]);

  // Initialize testimonial selections from server data
  useEffect(() => {
    if (!product?.id) return;
    if (testimonialIdsInitializedFor.current === product.id) return;
    if (assignedTestimonialIds === undefined) return;
    testimonialIdsInitializedFor.current = product.id;
    setSelectedTestimonialIds(new Set(assignedTestimonialIds));
  }, [assignedTestimonialIds, product?.id]);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: effectiveProduct ? f.slug : slugify(title),
    }));
  };

  const handleGenerate = async () => {
    const selectedCategory = categories.find((c) => c.id === form.categoryId);
    setGenerating(true);
    try {
      const result = await adminApi.products.generate({
        fileNames: form.title ? [form.title] : ['product'],
        fileTypes: form.types.length > 0 ? form.types : [form.type],
        productType: form.types[0] ?? form.type,
        categoryName: selectedCategory?.name,
      });
      setEditorResetToken((t) => t + 1);
      setForm((f) => ({
        ...f,
        title: result.title || f.title,
        description: result.description || f.description,
        howToUse: result.howToUse || f.howToUse,
        whatsIncluded: result.whatsIncluded || f.whatsIncluded,
      }));
      toast.success('AI агуулга үүсгэгдлээ');
    } catch {
      toast.error('AI үүсгэхэд алдаа гарлаа');
    } finally {
      setGenerating(false);
    }
  };

  function validate(): boolean {
    if (!form.title.trim()) {
      toast.error('Гарчиг заавал бөглөнө үү');
      return false;
    }
    if (!form.slug.trim()) {
      toast.error('URL slug заавал бөглөнө үү');
      return false;
    }
    const p = parseFloat(form.price);
    if (isNaN(p) || p < 0) {
      toast.error('Үнийн мэдээллийг зөв оруулна уу');
      return false;
    }
    return true;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const cap = parseFloat(form.compareAtPrice);
      // Зөвхөн одоо БОДИТ байгаа ангилалын id (устсаныг шүүнэ)
      const validCategoryIds = (form.categoryIds.length > 0
        ? form.categoryIds
        : form.categoryId ? [form.categoryId] : []
      ).filter((id) => categories.some((c) => c.id === id));
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price) || 0,
        compareAtPrice: !isNaN(cap) && cap > 0 ? cap : null,
        type: form.types[0] ?? form.type,
        // Устсан ангилалын id явуулахаас сэргийлж зөвхөн БОДИТ байгааг шүүнэ
        // (backend ч давхар шүүдэг — энэ нь UI түвшний нэмэлт хамгаалалт).
        categoryId: validCategoryIds[0],
        categoryIds: validCategoryIds,
        published: form.published,
        featured: form.featured,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        howToUse: form.howToUse || undefined,
        whatsIncluded: form.whatsIncluded || undefined,
        discountEndsAt: form.discountEndsAt || undefined,
        howToUseSteps: form.howToUseSteps,
        rating: parseFloat(form.rating) || 0,
        ratingCount: parseInt(form.ratingCount) || 0,
        proofImageUrl: form.proofImageUrl || null,
        proofQuote: form.proofQuote || null,
        proofText: form.proofText || null,
        proofAuthorName: form.proofAuthorName || null,
        proofAuthorRole: form.proofAuthorRole || null,
      };

      if (effectiveProduct) {
        if (form.slug !== effectiveProduct.slug) body.slug = form.slug;
        const updated = await adminApi.products.update(effectiveProduct.id, body);
        await Promise.allSettled([
          adminApi.products.assignFaqs(effectiveProduct.id, Array.from(selectedFaqIds)),
          adminApi.products.assignTestimonials(effectiveProduct.id, Array.from(selectedTestimonialIds)),
        ]);
        return updated;
      }

      body.slug = form.slug;
      const created = await adminApi.products.create(body);
      const tasks: Promise<unknown>[] = [];
      if (pendingFiles.length > 0) {
        let imageIdx = 0;
        // Дараалан upload — progress toast-г зөрчихгүй байлгана
        for (const item of pendingFiles) {
          const r = await uploadFileWithToast(item.file);
          if (item.type === 'video') {
            tasks.push(adminApi.products.images.addVideo(created.id, r.thumbnailUrl ?? r.url));
          } else {
            const variantPayload = r.variantData?.map((v) => ({
              size: v.size,
              fileKey: v.key,
              width: v.width,
              height: v.height,
              bytes: v.bytes,
            }));
            tasks.push(adminApi.products.images.addImage(created.id, r.key, item.file.name, imageIdx++ === 0, variantPayload));
          }
        }
      }
      if (selectedFaqIds.size > 0) {
        tasks.push(adminApi.products.assignFaqs(created.id, Array.from(selectedFaqIds)));
      }
      if (selectedTestimonialIds.size > 0) {
        tasks.push(adminApi.products.assignTestimonials(created.id, Array.from(selectedTestimonialIds)));
      }
      if (tasks.length > 0) await Promise.allSettled(tasks);
      return created;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      const wasNew = !product;
      justSavedRef.current = saved as AdminProduct;
      if (wasNew) {
        setSavedProduct(saved as AdminProduct);
        initializedForRef.current = (saved as AdminProduct).id;
        toast.success('Бүтээгдэхүүн нэмэгдлээ — таб ашиглан файл, багц нэмнэ үү');
      } else {
        // Refs-г reset хийж, дараагийн нээлтэд шинэ data-г fetch хийлгэнэ
        faqIdsInitializedFor.current = null;
        testimonialIdsInitializedFor.current = null;
        toast.success('Бүтээгдэхүүн шинэчлэгдлээ');
        onOpenChange(false);
      }
    },
    onError: (err: Error) => {
      const raw = err.message ?? '';
      if (raw.includes('slug')) {
        toast.error('Энэ URL slug аль хэдийн ашиглагдаж байна. Өөр slug оруулна уу.');
      } else {
        toast.error('Хадгалахад алдаа гарлаа');
      }
    },
  });

  async function handleProofImgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const result = await uploadFileWithToast(file);
      set('proofImageUrl', result.url);
      toast.success('Зураг ачаалагдлаа');
    } catch {
      toast.error('Зураг ачаалахад алдаа гарлаа');
    } finally {
      setUploadingProof(false);
      if (proofImgRef.current) proofImgRef.current.value = '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {savedProduct ? `✓ Үүслээ — нэмэлт мэдээлэл оруулах` : effectiveProduct ? 'Бүтээгдэхүүн засах' : 'Шинэ бүтээгдэхүүн'}
          </DialogTitle>
          <DialogPrimitive.Description className="sr-only">
            {effectiveProduct ? `${effectiveProduct.title} бүтээгдэхүүний мэдээллийг засах` : 'Шинэ бүтээгдэхүүн үүсгэх'}
          </DialogPrimitive.Description>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="w-full flex-wrap h-auto gap-0.5">
            <TabsTrigger value="basic" className="flex-1 text-xs">Үндсэн</TabsTrigger>
            <TabsTrigger value="content" className="flex-1 text-xs">Агуулга</TabsTrigger>
            <TabsTrigger value="proof" className="flex-1 text-xs">Proof</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1 text-xs">SEO</TabsTrigger>
            <TabsTrigger value="files" className="flex-1 text-xs">Файлууд</TabsTrigger>
            <TabsTrigger value="course" className="flex-1 text-xs">Хичээл</TabsTrigger>
            <TabsTrigger value="bundles" className="flex-1 text-xs">Багц</TabsTrigger>
            <TabsTrigger value="faqs" className="flex-1 text-xs">FAQ</TabsTrigger>
            <TabsTrigger value="testimonials" className="flex-1 text-xs">Сэтгэгдэл</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-5 pt-4">
            {/* Media */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Медиа</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <p className="text-xs text-muted-foreground">Олон зураг болон видео холилдуулан нэмнэ үү. Эхний зурагт бүтээгдэхүүний thumbnail байна.</p>
              <InlineMediaManager
                productId={effectiveProduct?.id}
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
              />
            </div>

            {/* Title & slug */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Үндсэн мэдээлэл</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Гарчиг <span className="text-destructive">*</span></Label>
                  <Input id="title" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} required placeholder="Бүтээгдэхүүний нэр" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">URL slug <span className="text-destructive">*</span></Label>
                  <Input id="slug" value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} required placeholder="url-slug" className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Тайлбар <span className="text-destructive">*</span></Label>
                <RichEditor
                  key={`description-${editorResetToken}`}
                  value={form.description}
                  onChange={(v) => set('description', v)}
                  placeholder="Бүтээгдэхүүний дэлгэрэнгүй тайлбар"
                  minHeight="120px"
                />
              </div>
            </div>

            {/* Pricing & classification */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Үнэ & Ангилал</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Зарах үнэ (₮) <span className="text-destructive">*</span></Label>
                  <Input id="price" type="number" min={0} step={100} value={form.price} onChange={(e) => set('price', e.target.value)} required placeholder="0 = Үнэгүй" />
                  <p className="text-[11px] text-muted-foreground">Худалдах одоогийн үнэ. 0 бол үнэгүй бүтээгдэхүүн болно.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="compareAtPrice">Хямдрахаас өмнөх үнэ</Label>
                  <Input id="compareAtPrice" type="number" min={0} step={100} value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} placeholder="Жишээ: 49900" />
                  <p className="text-[11px] text-muted-foreground">Зарах үнээс ӨНДӨР бол хямдралтай (зурсан) үнэ харагдана. Хоосон бол хямдрал харагдахгүй.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Төрөл <span className="text-destructive">*</span></Label>
                  <PopoverMultiSelect
                    options={productTypes}
                    // Устсан/идэвхгүй төрлийг шүүнэ — зөвхөн одоо БОДИТ байгаа төрөл
                    selected={form.types.filter((t) => productTypes.some((pt) => pt.value === t))}
                    placeholder="Төрөл сонгох..."
                    onChange={(next) => setForm((f) => ({ ...f, types: next, type: next[0] ?? '' }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ангилал</Label>
                  <PopoverMultiSelect
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    // Устсан ангилалын id-г шүүнэ — зөвхөн одоо БОДИТ байгаа ангилал
                    // (устсан id хадгалбал backend 500 өгдөг байсан).
                    selected={form.categoryIds.filter((id) => categories.some((c) => c.id === id))}
                    placeholder={categories.length === 0 ? 'Ангилал байхгүй' : 'Ангилал сонгох...'}
                    onChange={(next) => setForm((f) => ({
                      ...f,
                      categoryIds: next,
                      categoryId: next[0] ?? '',
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Хямдрал дуусах огноо</Label>
                <Input type="datetime-local" value={form.discountEndsAt} onChange={(e) => set('discountEndsAt', e.target.value)} className="max-w-xs" />
              </div>
            </div>

            {/* Status & ratings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Статус & Үнэлгээ</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex flex-wrap gap-6 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
                  <span className="font-medium">Нийтэлсэн</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                  <span className="font-medium">Онцлох</span>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rating">Үнэлгээ (0–5)</Label>
                  <Input id="rating" type="number" min={0} max={5} step={0.1} value={form.rating} onChange={(e) => set('rating', e.target.value)} placeholder="4.8" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ratingCount">Үнэлгээний тоо</Label>
                  <Input id="ratingCount" type="number" min={0} step={1} value={form.ratingCount} onChange={(e) => set('ratingCount', e.target.value)} placeholder="124" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-5 pt-4">
            {/* AI Generate */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium">AI Generate</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {aiEnabled ? 'Файлуудын нэрээс агуулгыг автоматаар үүсгэнэ' : 'ANTHROPIC_API_KEY тохируулаагүй тул идэвхгүй'}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleGenerate} disabled={generating || !aiEnabled} className="gap-2 shrink-0">
                <Sparkles className="h-4 w-4" />
                {generating ? 'Үүсгэж байна...' : 'AI Generate'}
              </Button>
            </div>

            {/* whatsIncluded */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Багцад юу багтсан вэ?</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <RichEditor
                key={`whatsIncluded-${editorResetToken}`}
                value={form.whatsIncluded}
                onChange={(v) => set('whatsIncluded', v)}
                placeholder="Файлуудын жагсаалт, агуулга..."
                minHeight="100px"
              />
            </div>

            {/* howToUse */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Хэрхэн ашиглах вэ?</span>
                <div className="flex-1 h-px bg-border" />
                <Button
                  type="button" size="sm" variant="ghost"
                  className="h-6 text-xs text-muted-foreground gap-1 px-2"
                  onClick={() => { setEditorResetToken((t) => t + 1); set('howToUse', DEFAULT_HOW_TO_USE); }}
                >
                  Дефолт болгох
                </Button>
              </div>
              <RichEditor
                key={`howToUse-${editorResetToken}`}
                value={form.howToUse}
                onChange={(v) => set('howToUse', v)}
                placeholder="Ашиглах заавар, дээд хэсэг..."
                minHeight="100px"
              />
            </div>

            {/* howToUseSteps */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Алхамууд</span>
                <div className="flex-1 h-px bg-border" />
                <div className="flex gap-1.5">
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-6 text-xs text-muted-foreground gap-1 px-2"
                    onClick={() => setForm((f) => ({ ...f, howToUseSteps: DEFAULT_HOW_TO_USE_STEPS }))}
                  >
                    Дефолт
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={() => setForm((f) => ({ ...f, howToUseSteps: [...f.howToUseSteps, { title: '', description: '' }] }))}
                  >
                    <Plus className="h-3 w-3" /> Алхам нэмэх
                  </Button>
                </div>
              </div>
              {form.howToUseSteps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-muted-foreground">
                  Алхам нэмэгдээгүй байна. Дугаарлагдсан картаар харуулна.
                </div>
              ) : (
                <div className="space-y-2">
                  {form.howToUseSteps.map((step, i) => (
                    <div key={i} className="group flex gap-3 rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <Input
                          value={step.title ?? ''}
                          onChange={(e) => {
                            const steps = [...form.howToUseSteps];
                            steps[i] = { ...steps[i], title: e.target.value };
                            setForm((f) => ({ ...f, howToUseSteps: steps }));
                          }}
                          placeholder="Алхмын гарчиг"
                          className="h-7 text-sm font-medium"
                        />
                        <Input
                          value={step.description ?? ''}
                          onChange={(e) => {
                            const steps = [...form.howToUseSteps];
                            steps[i] = { ...steps[i], description: e.target.value };
                            setForm((f) => ({ ...f, howToUseSteps: steps }));
                          }}
                          placeholder="Алхмын тайлбар"
                          className="h-7 text-xs"
                        />
                      </div>
                      <Button
                        type="button" size="icon" variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                        onClick={() => setForm((f) => ({ ...f, howToUseSteps: f.howToUseSteps.filter((_, idx) => idx !== i) }))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-5 pt-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Хайлтын системд (Google гэх мэт) харагдах гарчиг болон тайлбар. Хоосон орхивол бүтээгдэхүүний гарчиг, тайлбарыг автоматаар ашиглана.
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="seoTitle">SEO гарчиг</Label>
                <span className={`text-xs tabular-nums ${form.seoTitle.length > 60 ? 'text-amber-500' : 'text-muted-foreground'}`}>{form.seoTitle.length}/70</span>
              </div>
              <Input id="seoTitle" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder={form.title || 'SEO гарчиг'} maxLength={70} />
              {form.seoTitle.length === 0 && form.title && (
                <p className="text-xs text-muted-foreground">Автоматаар ашиглагдах: <span className="text-foreground">{form.title}</span></p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="seoDesc">SEO тайлбар</Label>
                <span className={`text-xs tabular-nums ${form.seoDescription.length > 140 ? 'text-amber-500' : 'text-muted-foreground'}`}>{form.seoDescription.length}/160</span>
              </div>
              <textarea
                id="seoDesc"
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                value={form.seoDescription}
                onChange={(e) => set('seoDescription', e.target.value)}
                placeholder="Хайлтын үр дүнд харагдах тайлбар (120–160 тэмдэгт)"
                maxLength={160}
              />
            </div>
            {/* Google preview */}
            {(form.seoTitle || form.title) && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Google Preview</span>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-green-700 dark:text-green-400 truncate">digitalger.mn › products › {form.slug || 'url-slug'}</p>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-0.5 line-clamp-1">{form.seoTitle || form.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{form.seoDescription || 'Тайлбар оруулаагүй байна...'}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Social Proof Tab */}
          <TabsContent value="proof" className="space-y-5 pt-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Бүтээгдэхүүний хуудаст харагдах "нийгмийн нотолгоо" блок. Иш үг заавал байх ёстой. Зураг болон нэр нэмэлт.
            </div>

            {/* Author */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Хүн</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex gap-4 items-start">
                {/* Avatar upload */}
                <div className="shrink-0">
                  {form.proofImageUrl ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.proofImageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => set('proofImageUrl', '')}
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      onClick={() => proofImgRef.current?.click()}
                      disabled={uploadingProof}
                    >
                      {uploadingProof ? <Star className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    </button>
                  )}
                  <input ref={proofImgRef} type="file" accept="image/*" className="hidden" onChange={handleProofImgUpload} />
                </div>
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Нэр</Label>
                    <Input value={form.proofAuthorName} onChange={(e) => set('proofAuthorName', e.target.value)} placeholder="Бат-Эрдэнэ Д." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Албан тушаал</Label>
                    <Input value={form.proofAuthorRole} onChange={(e) => set('proofAuthorRole', e.target.value)} placeholder="Маркетингийн менежер" />
                  </div>
                </div>
              </div>
              {form.proofImageUrl && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => proofImgRef.current?.click()} disabled={uploadingProof}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingProof ? 'Ачаалж...' : 'Зураг солих'}
                </Button>
              )}
            </div>

            {/* Quote */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Иш үг</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Үндсэн иш үг <span className="text-destructive">*</span></Label>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  value={form.proofQuote}
                  onChange={(e) => set('proofQuote', e.target.value)}
                  placeholder="Томоор харагдах гол мессеж..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Дэлгэрэнгүй текст <span className="text-xs text-muted-foreground font-normal">(заавал биш)</span></Label>
                <textarea
                  className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  value={form.proofText}
                  onChange={(e) => set('proofText', e.target.value)}
                  placeholder="Нэмэлт тайлбар текст..."
                />
              </div>
            </div>

            {/* Preview */}
            {form.proofQuote && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preview</span>
                <div className="flex gap-4 items-start rounded-xl border border-border bg-muted/20 p-4">
                  {form.proofImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.proofImageUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {form.proofAuthorName ? form.proofAuthorName.charAt(0) : '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold italic leading-snug">"{form.proofQuote}"</p>
                    {form.proofText && <p className="mt-1 text-xs text-muted-foreground">{form.proofText}</p>}
                    {(form.proofAuthorName || form.proofAuthorRole) && (
                      <p className="mt-2 text-xs font-medium">
                        {form.proofAuthorName}{form.proofAuthorRole && <span className="text-muted-foreground font-normal"> · {form.proofAuthorRole}</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="pt-4">
            <FilesTab productId={effectiveProduct?.id} product={effectiveProduct} />
          </TabsContent>

          {/* Course Tab */}
          <TabsContent value="course" className="pt-4">
            <CourseTab productId={effectiveProduct?.id} />
          </TabsContent>

          {/* Bundle Tab */}
          <TabsContent value="bundles" className="pt-4">
            <BundleTab productId={effectiveProduct?.id} />
          </TabsContent>

          {/* FAQ Assignment Tab */}
          <TabsContent value="faqs" className="pt-4">
            <FaqAssignTab
              selectedIds={selectedFaqIds}
              onToggle={(id) => setSelectedFaqIds((s) => {
                const next = new Set(s);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })}
            />
          </TabsContent>

          {/* Testimonial Assignment Tab */}
          <TabsContent value="testimonials" className="pt-4">
            <TestimonialAssignTab
              selectedIds={selectedTestimonialIds}
              onToggle={(id) => setSelectedTestimonialIds((s) => {
                const next = new Set(s);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {savedProduct ? 'Хаах' : 'Цуцлах'}
          </Button>
          {!savedProduct && (
            <Button
              onClick={() => {
                if (!validate()) return;
                mutation.mutate();
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Хадгалж байна...' : effectiveProduct ? 'Хадгалах' : 'Үүсгэх'}
            </Button>
          )}
          {savedProduct && (
            <Button
              onClick={() => {
                if (!validate()) return;
                mutation.mutate();
              }}
              disabled={mutation.isPending}
              variant="outline"
            >
              {mutation.isPending ? 'Хадгалж байна...' : 'Дахин хадгалах'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
