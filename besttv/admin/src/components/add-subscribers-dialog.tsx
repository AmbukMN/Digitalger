'use client';

import { useState } from 'react';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';

/**
 * ADMIN ИМЭЙЛ ГАРААР НЭМЭХ — нэг эсвэл олноор.
 *
 * ⚠️ Backend upsert (идемпотент) тул давхардвал алдаа өгөхгүй,
 *    цуцалсан хаягийг сэргээнэ. Олон имэйлийг мөр/таслал/зайгаар салгана.
 */
export function AddSubscribersDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'one' | 'many'>('one');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [saving, setSaving] = useState(false);

  const parseEmails = (raw: string): string[] =>
    [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];

  const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const submit = async () => {
    const emails = mode === 'one' ? [email.trim().toLowerCase()] : parseEmails(bulk);
    const valid = emails.filter(isEmail);
    const invalid = emails.length - valid.length;

    if (!valid.length) {
      toast.error('Зөв имэйл оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ added: number; total: number }>('/admin/email/subscribers/add', {
        method: 'POST',
        body: JSON.stringify({ emails: valid, name: mode === 'one' ? name.trim() : undefined }),
      });
      toast.success(
        `${res.added.toLocaleString()} имэйл нэмэгдлээ` +
          (invalid ? ` (${invalid} буруу алгаслаа)` : ''),
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Нэмж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  const previewCount = mode === 'many' ? parseEmails(bulk).filter(isEmail).length : 0;

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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('one')}
              className={
                'rounded-lg border p-2.5 text-sm font-medium transition-colors ' +
                (mode === 'one'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:border-primary/40')
              }
            >
              Нэг нэгээр
            </button>
            <button
              onClick={() => setMode('many')}
              className={
                'flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition-colors ' +
                (mode === 'many'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:border-primary/40')
              }
            >
              <Users size={14} /> Олноор
            </button>
          </div>

          {mode === 'one' ? (
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
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Имэйлүүд <span className="text-muted-foreground/60">(мөр, таслал эсвэл зайгаар салгана)</span>
              </label>
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={7}
                placeholder={'nэг@gmail.com\nхоёр@gmail.com\nгурав@gmail.com'}
                className="w-full resize-y rounded-md border border-input bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              {!!bulk.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong className="text-foreground">{previewCount}</strong> зөв имэйл олдлоо
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Болих
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Нэмэх
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
