'use client';

import { useState } from 'react';
import { Loader2, Megaphone, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';

/**
 * КИНО РЕКЛАМ — тухайн киног бүх хэрэглэгчид promotion имэйлээр bulk илгээх.
 *
 * ⚠️ Backend нь постер + тайлбар + «Үзэх» товч бүхий имэйл автоматаар үүсгэнэ
 *    (кино/сериал ялгаагүй). Энд зөвхөн хүлээн авагч бүлэг + (сонголтоор)
 *    гарчиг тохируулна. Давхардал/цуцалсныг backend хасна.
 */
export function PromoteTitleDialog({
  titleId,
  titleName,
  onClose,
}: {
  titleId: string;
  titleName: string;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<'both' | 'users' | 'subscribers'>('both');
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await api<{ queued: number }>('/admin/email/promote-title', {
        method: 'POST',
        body: JSON.stringify({
          titleId,
          audience,
          subject: subject.trim() || undefined,
          heading: heading.trim() || undefined,
        }),
      });
      toast.success(`${res.queued.toLocaleString()} хэрэглэгчид рекламын имэйл дараалалд орлоо`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Илгээж чадсангүй');
    } finally {
      setSending(false);
    }
  };

  const AUDIENCES = [
    { id: 'both' as const, label: 'Бүгд', desc: 'Хэрэглэгч + бүртгүүлэгчид' },
    { id: 'users' as const, label: 'Хэрэглэгчид', desc: 'Бүртгэлтэй хэрэглэгчид' },
    { id: 'subscribers' as const, label: 'Бүртгүүлэгчид', desc: 'Имэйл жагсаалт' },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={18} className="text-primary" />
            Рекламын имэйл
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground">
            «<strong>{titleName}</strong>» киног постер, тайлбар, «Үзэх» товчтой
            promotion имэйл болгож сонгосон бүлэгт илгээнэ.
          </p>

          {/* Хүлээн авагч */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users size={13} /> Хүлээн авагч
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAudience(a.id)}
                  className={
                    'rounded-lg border p-2.5 text-left transition-colors ' +
                    (audience === a.id
                      ? 'border-primary bg-primary/10'
                      : 'border-input hover:border-primary/40')
                  }
                >
                  <span className="block text-sm font-medium text-foreground">{a.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Гарчиг (сонголтоор) */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Имэйлийн гарчиг <span className="text-muted-foreground/60">(хоосон = автомат)</span>
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`${titleName} — BestTV дээр үзээрэй`}
              maxLength={200}
              className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Толгой текст <span className="text-muted-foreground/60">(хоосон = киноны нэр)</span>
            </label>
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder={titleName}
              maxLength={200}
              className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={sending}
              className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Болих
            </button>
            <button
              onClick={send}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Илгээх
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
