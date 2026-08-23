'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Loader2, Upload, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';

type Mode = 'one' | 'many' | 'file';

interface ParsedRow {
  email: string;
  name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (e: string) => EMAIL_RE.test(e.trim());

/** Толгойн нэрээс имэйл/нэр багана таних (олон хэл, олон бичлэг) */
const EMAIL_KEYS = ['email', 'имэйл', 'имейл', 'mail', 'e-mail', 'цахим', 'хаяг'];
const NAME_KEYS = ['name', 'нэр', 'full name', 'бүтэн нэр', 'овог', 'хэрэглэгч'];

/**
 * ADMIN ИМЭЙЛ ГАРААР/ФАЙЛААР НЭМЭХ — нэг, олноор, эсвэл файлаас.
 *
 * ⚠️ Файл: .xlsx / .xls / .csv / .txt. SheetJS нь бүгдийг уншина.
 *    Толгой мөр байвал «email»/«имэйл» багана + «нэр» баганыг АВТОМАТААР
 *    олно (олон хэл). Толгойгүй бол имэйл хэлбэртэй утга бүрийг цуглуулна.
 * ⚠️ Backend upsert (идемпотент) тул давхардвал алдаагүй.
 */
export function AddSubscribersDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('one');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseTextEmails = (raw: string): ParsedRow[] =>
    [
      ...new Set(
        raw
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e && isEmail(e)),
      ),
    ].map((email) => ({ email }));

  /** Файл → мөрүүд (SheetJS). Толгойгоор багана таних, эс бол имэйл хайх. */
  const parseFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // 2D массив (толгой + мөрүүд)
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
      if (!rows.length) {
        toast.error('Файл хоосон байна');
        setParsed([]);
        return;
      }

      const found = new Map<string, ParsedRow>();

      // Толгой мөрөөр багана таних
      const header = (rows[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase());
      const emailCol = header.findIndex((h) => EMAIL_KEYS.some((k) => h.includes(k)));
      const nameCol = header.findIndex((h) => NAME_KEYS.some((k) => h.includes(k)));
      const hasHeader = emailCol !== -1;

      const dataRows = hasHeader ? rows.slice(1) : rows;
      for (const row of dataRows) {
        const cells = (row ?? []).map((c) => String(c ?? '').trim());
        let em = '';
        let nm = '';
        if (hasHeader) {
          em = (cells[emailCol] ?? '').toLowerCase();
          nm = nameCol !== -1 ? cells[nameCol] ?? '' : '';
        } else {
          // Толгойгүй — мөрөөс имэйл хэлбэртэй нүдийг ол, бусад нүд=нэр
          em = (cells.find((c) => isEmail(c)) ?? '').toLowerCase();
          nm = cells.find((c) => c && !isEmail(c)) ?? '';
        }
        if (em && isEmail(em) && !found.has(em)) found.set(em, { email: em, name: nm || undefined });
      }

      const list = [...found.values()];
      setParsed(list);
      if (!list.length) toast.error('Файлаас имэйл олдсонгүй');
      else toast.success(`${list.length} имэйл олдлоо`);
    } catch (e) {
      toast.error('Файл уншиж чадсангүй — .xlsx / .csv / .txt эсэхийг шалгана уу');
      setParsed(null);
    } finally {
      setParsing(false);
    }
  };

  const submit = async () => {
    let rows: ParsedRow[] = [];
    if (mode === 'one') {
      const em = email.trim().toLowerCase();
      if (!isEmail(em)) return toast.error('Зөв имэйл оруулна уу');
      rows = [{ email: em, name: name.trim() || undefined }];
    } else if (mode === 'many') {
      rows = parseTextEmails(bulk);
    } else {
      rows = parsed ?? [];
    }

    if (!rows.length) return toast.error('Нэмэх имэйл алга');

    setSaving(true);
    try {
      const res = await api<{ added: number; total: number }>('/admin/email/subscribers/add', {
        method: 'POST',
        body: JSON.stringify({
          // ⚠️ Backend нэрийг зөвхөн НЭГ имэйлд авдаг тул мөр бүрийг
          // нэртэйгээр илгээхийн тулд items массив дэмжлэг нэмсэн (доор).
          emails: rows.map((r) => r.email),
          items: rows,
        }),
      });
      toast.success(`${res.added.toLocaleString()} имэйл нэмэгдлээ`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Нэмж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  const previewCount =
    mode === 'many'
      ? parseTextEmails(bulk).length
      : mode === 'file'
        ? parsed?.length ?? 0
        : 0;

  const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'one', label: 'Нэг нэгээр', icon: <UserPlus size={14} /> },
    { id: 'many', label: 'Олноор', icon: <Users size={14} /> },
    { id: 'file', label: 'Файлаас', icon: <FileSpreadsheet size={14} /> },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            Имэйл нэмэх
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Горим сонголт */}
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={
                  'flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition-colors ' +
                  (mode === m.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-input text-muted-foreground hover:border-primary/40')
                }
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {mode === 'one' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Имэйл хаяг
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="jishee@gmail.com"
                  className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Нэр <span className="text-muted-foreground/60">(заавал биш)</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Нэр"
                  maxLength={120}
                  className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          {mode === 'many' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Имэйлүүд{' '}
                <span className="text-muted-foreground/60">
                  (мөр, таслал эсвэл зайгаар салгана)
                </span>
              </label>
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={7}
                placeholder={'нэг@gmail.com\nхоёр@gmail.com\nгурав@gmail.com'}
                className="w-full resize-y rounded-md border border-input bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              {!!bulk.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong className="text-foreground">{previewCount}</strong> зөв имэйл олдлоо
                </p>
              )}
            </div>
          )}

          {mode === 'file' && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) parseFile(f);
                }}
              />
              {!parsed && !parsing ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
                >
                  <Upload size={26} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Файл сонгох</span>
                  <span className="text-xs text-muted-foreground">
                    Excel (.xlsx, .xls), CSV, TXT · name/email багана авто танина
                  </span>
                </button>
              ) : parsing ? (
                <div className="flex h-32 items-center justify-center gap-2 rounded-xl border border-input">
                  <Loader2 size={18} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Уншиж байна…</span>
                </div>
              ) : (
                <div className="rounded-xl border border-input">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileSpreadsheet size={16} className="shrink-0 text-primary" />
                      <span className="truncate text-sm text-foreground">{fileName}</span>
                    </span>
                    <button
                      onClick={() => {
                        setParsed(null);
                        setFileName('');
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Арилгах"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-sm text-foreground">
                      <strong>{parsed?.length ?? 0}</strong> имэйл олдлоо
                    </p>
                    {/* Эхний 5 мөрийн урьдчилан харах */}
                    {!!parsed?.length && (
                      <div className="mt-2 max-h-32 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        {parsed.slice(0, 5).map((r) => (
                          <div key={r.email} className="truncate py-0.5">
                            {r.email}
                            {r.name ? ` — ${r.name}` : ''}
                          </div>
                        ))}
                        {parsed.length > 5 && (
                          <div className="py-0.5 text-muted-foreground/60">
                            …бас {parsed.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {previewCount > 0 && mode !== 'one' && (
                <>
                  <strong className="text-foreground">{previewCount.toLocaleString()}</strong> имэйл
                  нэмэгдэнэ
                </>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Болих
              </button>
              <button
                onClick={submit}
                disabled={saving || parsing || (mode === 'file' && !parsed?.length)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                Нэмэх
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
