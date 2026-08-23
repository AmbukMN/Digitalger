'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, Megaphone, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';

/**
 * КИНО РЕКЛАМ — тухайн киног бүх хэрэглэгчид promotion имэйлээр bulk илгээх.
 *
 * ⚠️ Backend нь постер + тайлбар + «Үзэх» товч бүхий имэйл автоматаар үүсгэнэ
 *    (кино/сериал ялгаагүй). Энд хүлээн авагч бүлэг (тоотой) + гарчиг +
 *    ЯГ ЯАЖ ОЧИХ preview харна. Давхардал/цуцалсныг backend хасна.
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
  const [showPreview, setShowPreview] = useState(false);

  /** Хүлээн авагчийн БОДИТ тоо (opt-out хасагдсан) */
  const { data: counts } = useQuery({
    queryKey: ['admin-email-audience-counts'],
    queryFn: () =>
      api<{ subscribers: number; users: number; both: number }>(
        '/admin/email/audience-counts',
      ),
    staleTime: 60_000,
  });

  /** Preview — имэйл яг яаж очих (iframe) */
  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['admin-email-promote-preview', titleId],
    queryFn: () =>
      api<{ found: boolean; html: string }>(
        `/admin/email/promote-title/${titleId}/preview`,
      ),
    enabled: showPreview,
    staleTime: 5 * 60_000,
  });

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
    {
      id: 'both' as const,
      label: 'Бүгд',
      desc: 'Хэрэглэгч + бүртгүүлэгч',
      count: counts?.both,
    },
    {
      id: 'users' as const,
      label: 'Хэрэглэгчид',
      desc: 'Данс нээсэн, нэвтэрдэг',
      count: counts?.users,
    },
    {
      id: 'subscribers' as const,
      label: 'Бүртгүүлэгчид',
      desc: 'Зөвхөн имэйл өгсөн',
      count: counts?.subscribers,
    },
  ];

  const activeCount = AUDIENCES.find((a) => a.id === audience)?.count;

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

          {/* Хүлээн авагч — БОДИТ тоотой */}
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
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{a.label}</span>
                    {typeof a.count === 'number' && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {a.count.toLocaleString()}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                    {a.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Гарчиг + Толгой */}
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

          {/* Preview — имэйл яг яаж очих */}
          <div>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Eye size={15} /> {showPreview ? 'Preview нуух' : 'Имэйл preview харах'}
            </button>
            {showPreview && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border bg-white">
                {previewLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : preview?.html ? (
                  <iframe
                    srcDoc={preview.html}
                    title="Имэйл preview"
                    sandbox=""
                    className="h-[440px] w-full border-0"
                  />
                ) : (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Preview ачаалж чадсангүй
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {typeof activeCount === 'number' ? (
                <>
                  <strong className="text-foreground">{activeCount.toLocaleString()}</strong> хүнд
                  очно
                </>
              ) : (
                'Хүлээн авагчийг тоолж байна…'
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Болих
              </button>
              <button
                onClick={send}
                disabled={sending || activeCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Илгээх
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
