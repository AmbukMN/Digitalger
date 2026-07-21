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
  Send,
  Eye,
  Users,
  Layers,
  Loader2,
  CheckCircle2,
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
import { uploadWithProgress } from '@/lib/upload-with-progress';
import { TagInput } from '@/components/ui/tag-input';
import { RichEditor } from '@/components/ui/rich-editor';
import { SimpleDropdown, SimpleDropdownItem } from '@/components/ui/simple-dropdown';
import { Pagination } from '@/components/ui/pagination';
import { EMAIL_TEMPLATES } from '@/lib/email-templates';
import type { AdminSubscriber, AdminSubscriberCategory } from '@/types/admin';

// Захиалагчийн эх сурвалжууд (filter + илгээлтэд) — Монгол нэртэйгээр
const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'homepage', label: 'Нүүр хуудас' },
  { value: 'free-ppt', label: 'Үнэгүй PPT' },
  { value: 'checkout', label: 'Худалдан авалт' },
  { value: 'popup', label: 'Поп-ап' },
  { value: 'web-register', label: 'Веб бүртгэл' },
  { value: 'admin', label: 'Админ' },
  { value: 'import', label: 'Импорт' },
];

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Нэр</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Овог</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

// ─── Bulk marketing email compose dialog (Mailchimp маягийн) ──────────────────
// Хүлээн авагчийг олон filter хослолоор (сонгосон / status / категори / эх сурвалж) сонгох,
// VISUAL editor (TipTap rich text + зураг/видео upload + CTA товч), бодит email preview,
// background queue-ийн илгээлтийн явц (poll).
type RecipientMode = 'selected' | 'filter';

function EmailComposeDialog({
  open,
  selectedIds,
  categories,
  onClose,
}: {
  open: boolean;
  selectedIds: string[];
  categories: AdminSubscriberCategory[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<RecipientMode>('filter');
  // Filter горимын олон шүүлт (хослуулна): status + категори + эх сурвалж
  const [fStatus, setFStatus] = useState<'ACTIVE' | 'INACTIVE' | 'UNSUBSCRIBED' | 'all'>('ACTIVE');
  const [fCategory, setFCategory] = useState<string>('all');
  const [fSource, setFSource] = useState<string>('all');

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Dialog нээгдэх бүрд reset. Сонгосон байвал 'selected', эс бол 'filter'.
  useEffect(() => {
    if (open) {
      setMode(selectedIds.length > 0 ? 'selected' : 'filter');
      setFStatus('ACTIVE');
      setFCategory('all');
      setFSource('all');
      setSubject('');
      setBody('');
      setShowPreview(false);
      setConfirmOpen(false);
      setCampaignId(null);
    }
  }, [open, selectedIds.length]);

  // Илгээх payload-ийг filter-уудаас бүрдүүлнэ (status='all' бол status илгээхгүй)
  const buildPayload = () => {
    const p: {
      recipientIds?: string[];
      status?: 'ACTIVE' | 'INACTIVE' | 'UNSUBSCRIBED';
      categoryId?: string;
      source?: string;
    } = {};
    if (mode === 'selected') {
      p.recipientIds = selectedIds;
    } else {
      if (fStatus !== 'all') p.status = fStatus;
      if (fCategory !== 'all') p.categoryId = fCategory;
      if (fSource !== 'all') p.source = fSource;
    }
    return p;
  };

  // ── Хүлээн авагчийн тоог сервер талд тооцоолно (filter өөрчлөгдөх бүрд) ──
  const countKey = mode === 'selected'
    ? ['sel', selectedIds.length]
    : ['flt', fStatus, fCategory, fSource];
  const { data: countData, isFetching: countLoading } = useQuery({
    queryKey: ['admin', 'recipient-count', countKey],
    queryFn: () => adminApi.subscribers.countRecipients(buildPayload()),
    enabled: open && !(mode === 'selected'),
    staleTime: 10_000,
  });
  const recipientCount = mode === 'selected' ? selectedIds.length : countData?.count ?? null;

  // ── Background queue явцыг poll хийх ──
  const { data: progress } = useQuery({
    queryKey: ['admin', 'campaign-progress', campaignId],
    queryFn: () => adminApi.subscribers.campaignProgress(campaignId as string),
    enabled: !!campaignId,
    refetchInterval: (q) => (q.state.data?.done ? false : 2000),
  });

  const sendMut = useMutation({
    mutationFn: () => adminApi.subscribers.sendEmail({ ...buildPayload(), subject: subject.trim(), bodyHtml: body }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      if (res.campaign && res.total > 0) {
        // Background queue — явцыг campaign-аар хянана
        setCampaignId(res.campaign);
        toast.success(`${res.total} имэйл дараалалд нэмэгдлээ — илгээгдэж байна...`, { duration: 4000 });
      } else {
        // Хүлээн авагч олдсонгүй (бүгд UNSUBSCRIBED / шүүлтэд тохирохгүй)
        toast.error('Хүлээн авагч олдсонгүй — шүүлтээ шалгана уу');
      }
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Имэйл илгээхэд алдаа гарлаа');
      setConfirmOpen(false);
    },
  });

  // Хүлээн авагчийн тайлбар (баталгаажуулалт + footer-т)
  const recipientLabel = (() => {
    if (mode === 'selected') return `Сонгосон ${selectedIds.length} захиалагч`;
    const parts: string[] = [];
    parts.push(fStatus === 'all' ? 'Бүх төлөв' : STATUS_LABEL[fStatus]);
    if (fCategory !== 'all') parts.push(`«${categories.find((c) => c.id === fCategory)?.name ?? 'категори'}»`);
    if (fSource !== 'all') parts.push(SOURCE_OPTIONS.find((s) => s.value === fSource)?.label ?? fSource);
    return parts.join(' · ');
  })();

  const canSend =
    subject.trim().length > 0 &&
    body.replace(/<[^>]*>/g, '').trim().length > 0 &&
    !(mode === 'selected' && selectedIds.length === 0) &&
    (recipientCount === null || recipientCount > 0);

  // ⚠️ Бодит EmailService.emailHeader()-тэй ЯГ адил preview (logo image + DigitalGer.mn).
  // Backend дээр template өөрчлөгдвөл энд мөн тааруулна.
  const previewHtml = `
    <div style="max-width:600px;margin:0 auto;font-family:Roboto,'Helvetica Neue',Arial,system-ui,sans-serif;color:#1f2937">
      <div style="background:#022179;padding:20px 36px;border-radius:12px 12px 0 0;text-align:center">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
          <td style="vertical-align:middle;padding-right:12px">
            <img src="https://digitalger.mn/brand/DigitalGer-color%20logo-NoBG.png" alt="DigitalGer" height="40" style="height:40px;width:auto;display:block;border:0" />
          </td>
          <td style="vertical-align:middle">
            <span style="font-size:20px;font-weight:800;color:#ffffff;vertical-align:middle">DigitalGer.mn</span>
          </td>
        </tr></table>
      </div>
      <div style="background:#ffffff;padding:34px 36px;border:1px solid #eee;border-top:0">
        ${body || '<p style="color:#9ca3af">Агуулга хоосон байна…</p>'}
      </div>
      <div style="background:#f8f9fb;padding:20px 36px;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:0;text-align:center">
        <p style="margin:0;font-size:12px;color:#aaa">© ${new Date().getFullYear()} DigitalGer · digitalger.mn</p>
        <p style="margin:6px 0 0;font-size:11px;color:#c0c4cc">Захиалга цуцлах холбоос автоматаар нэмэгдэнэ</p>
      </div>
    </div>`;

  const sending = sendMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !sending && onClose()}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Имэйл кампанит ажил
            </DialogTitle>
          </DialogHeader>

          {/* Илгээлтийн явц (background queue) */}
          {campaignId && progress ? (
            <CampaignProgressView progress={progress} onClose={onClose} />
          ) : (
            <div className="space-y-4">
              {/* ── Хүлээн авагч ── */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Хүлээн авагч</Label>
                  <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary">
                    {countLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Users className="h-3 w-3" />
                    )}
                    {recipientCount !== null ? `${recipientCount.toLocaleString()} хүн` : '…'}
                  </div>
                </div>

                {/* Горим: сонгосон / шүүлтээр */}
                <div className="flex flex-wrap gap-2">
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMode('selected')}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        mode === 'selected' ? 'border-primary bg-muted text-primary' : 'border-border hover:bg-muted'
                      }`}
                    >
                      Сонгосон ({selectedIds.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode('filter')}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'filter' ? 'border-primary bg-muted text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" /> Шүүлтээр
                  </button>
                </div>

                {/* Filter горимын олон шүүлт */}
                {mode === 'filter' && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Төлөв</Label>
                      <Select value={fStatus} onValueChange={(v) => setFStatus(v as typeof fStatus)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Идэвхтэй</SelectItem>
                          <SelectItem value="INACTIVE">Идэвхгүй</SelectItem>
                          <SelectItem value="UNSUBSCRIBED">Орхисон</SelectItem>
                          <SelectItem value="all">Бүх төлөв</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Категори</Label>
                      <Select value={fCategory} onValueChange={setFCategory}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Бүх категори" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Бүх категори</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.count})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Эх сурвалж</Label>
                      <Select value={fSource} onValueChange={setFSource}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Бүх эх сурвалж" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Бүх эх сурвалж</SelectItem>
                          {SOURCE_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Орхисон (захиалга цуцалсан) хаягууд руу автоматаар илгээгдэхгүй.
                </p>
              </div>

              {/* ── Бэлэн template ── нэг товчоор subject+body бөглөнө (давтан бичихгүй) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Бэлэн загвар сонгох (заавал биш)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setSubject(t.subject);
                        setBody(t.body);
                        setShowPreview(false);
                        toast.success(`"${t.label}" загвар орууллаа — засаад илгээнэ үү`);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-muted px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted/70"
                      title={t.subject}
                    >
                      <span>{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Загвар дарвал гарчиг, агуулга автоматаар бөглөгдөнө. Дараа нь засаж болно.
                </p>
              </div>

              {/* ── Гарчиг ── */}
              <div className="space-y-1.5">
                <Label>Гарчиг (Subject) *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Жишээ: 🎉 Шинэ хямдрал эхэллээ!"
                  maxLength={200}
                />
              </div>

              {/* ── Агуулга (Visual editor) / Preview ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Агуулга *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowPreview((v) => !v)}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    {showPreview ? 'Засах' : 'Имэйл харагдац'}
                  </Button>
                </div>
                {showPreview ? (
                  <div className="rounded-lg border border-border bg-[#f1f3f7] p-4 dark:bg-muted/30">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                ) : (
                  <RichEditor
                    value={body}
                    onChange={setBody}
                    emailMode
                    minHeight="260px"
                    placeholder="Сайн байна уу! Манай шинэ бүтээгдэхүүнтэй танилцаарай…"
                    onImageUpload={async (file) => {
                      const res = await uploadWithProgress(file, 'email');
                      return res.url;
                    }}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Гарчиг, текст, зураг, видео, CTA товч нэмэх боломжтой. Брэндийн header/footer автоматаар нэмэгдэнэ.
                </p>
              </div>
            </div>
          )}

          {!campaignId && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Болих</Button>
              <Button type="button" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
                <Send className="mr-1.5 h-4 w-4" /> Явуулах
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Баталгаажуулалт — санамсаргүй явуулахаас сэргийлэх */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && !sending && setConfirmOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Имэйл явуулах уу?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Хүлээн авагч:</span>{' '}
              <span className="font-medium">{recipientLabel}</span>
              {recipientCount !== null && (
                <span className="ml-1 font-semibold text-primary">({recipientCount.toLocaleString()} хүн)</span>
              )}
            </p>
            <p><span className="text-muted-foreground">Гарчиг:</span> <span className="font-medium">{subject.trim() || '—'}</span></p>
            <p className="text-xs text-muted-foreground">Илгээсэн имэйлийг буцаах боломжгүй.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => setConfirmOpen(false)}>Цуцлах</Button>
            <Button disabled={sending} onClick={() => sendMut.mutate()}>
              {sending ? 'Илгээж байна...' : 'Тийм, явуулах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Background queue-ийн илгээлтийн явц (progress bar + тоонууд)
function CampaignProgressView({
  progress,
  onClose,
}: {
  progress: import('@/types/admin').EmailCampaignProgress;
  onClose: () => void;
}) {
  const { total, sent, failed, done } = progress;
  const processed = sent + failed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : (done ? 100 : 0);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-3">
        {done ? (
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        )}
        <div>
          <p className="font-semibold">
            {done
              ? failed > 0
                ? `Илгээлт дууслаа · ${failed} амжилтгүй`
                : 'Илгээлт амжилттай дууслаа'
              : 'Илгээж байна…'}
          </p>
          <p className="text-xs text-muted-foreground">
            {processed.toLocaleString()} / {total.toLocaleString()} боловсруулсан
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Явц</span>
          <span className="font-bold tabular-nums">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${done && failed > 0 && sent === 0 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-lg font-bold tabular-nums">{total.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Нийт</p>
        </div>
        <div className="rounded-lg bg-green-50 p-2.5 dark:bg-green-900/20">
          <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{sent.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Илгээсэн</p>
        </div>
        <div className="rounded-lg bg-red-50 p-2.5 dark:bg-red-900/20">
          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{failed.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Амжилтгүй</p>
        </div>
      </div>

      {done && (
        <div className="flex justify-end">
          <Button onClick={onClose}>Хаах</Button>
        </div>
      )}
    </div>
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
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Export — token-той server side татах + progress toast (том файлд)
  async function handleExport(format: 'excel' | 'pdf') {
    setExporting(true);
    const toastId = `export-${format}`;
    toast.loading(`${format === 'excel' ? 'Excel' : 'PDF'} бэлдэж байна...`, { id: toastId, duration: Infinity });
    try {
      await adminApi.subscribers.exportDownload(
        { format, status, categoryId, source },
        (percent) => {
          if (percent != null && percent < 100) {
            toast.loading(`Татаж байна... ${percent}%`, { id: toastId, duration: Infinity });
          }
        },
      );
      toast.success(
        format === 'excel' ? 'Excel татагдлаа' : 'Хэвлэх цонх нээгдлээ — "PDF болгож хадгалах"-ыг сонгоно уу',
        { id: toastId, duration: 3500 },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export алдаа', { id: toastId, duration: 3000 });
    } finally {
      setExporting(false);
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Subscriber
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Имэйл захиалагчдыг удирдах ({total})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}>
            <FolderPlus className="mr-1.5 h-4 w-4" /> Категори
          </Button>
          <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
            <Send className="mr-1.5 h-4 w-4" /> Имэйл явуулах
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
            disabled={total === 0 || exporting}
            trigger={
              <Button variant="outline" disabled={total === 0 || exporting}>
                <Download className="mr-1.5 h-4 w-4" /> {exporting ? 'Бэлдэж байна...' : 'Export'}
                <ChevronDown className="ml-1.5 h-4 w-4 opacity-60" />
              </Button>
            }
          >
            {(close) => (
              <>
                <SimpleDropdownItem onClick={() => { handleExport('excel'); close(); }}>
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel татах
                </SimpleDropdownItem>
                <SimpleDropdownItem onClick={() => { handleExport('pdf'); close(); }}>
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
                {SOURCE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-muted px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} сонгогдсон</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={(v) => bulkAssignMut.mutate(v === 'none' ? null : v)}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Категорид зүүх" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Категори хасах</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Имэйл явуулах
            </Button>
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
              <table className="w-full min-w-max text-sm">
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
                    <tr key={s.id} className={`border-b border-border/50 hover:bg-muted/30 ${selectedIds.has(s.id) ? 'bg-muted' : ''}`}>
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
      <EmailComposeDialog
        open={emailDialogOpen}
        selectedIds={[...selectedIds]}
        categories={categories}
        onClose={() => setEmailDialogOpen(false)}
      />

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
