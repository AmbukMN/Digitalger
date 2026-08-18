'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Info, Loader2, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { GalleryEditor, isVideoEntry, type GalleryEntry } from '@/components/gallery-editor';
import {
  CHANNEL_META,
  FB_FOLD,
  IG_CAPTION_MAX,
  IG_FOLD,
  type Channel,
  type SocialPost,
  type ValidationIssue,
} from './types';
import {
  UB_LABEL,
  browserOffsetDiffersFromUb,
  ubInputToUtc,
  utcToUbInput,
} from './ub-time';

/**
 * НИЙТЛЭЛ ЗОХИОХ (Buffer-ийн composer загвар).
 *
 * ⚠️⚠️ ГОЛ ЗАРЧИМ: алдааг НИЙТЛЭХ үед биш, ЗОХИОХ үед барина.
 * Meta-гийн алдаа нь нийтлэх агшинд л гардаг — тэр үед админ аль
 * хэдийн товлочихсон, шөнө дундын пост чимээгүй унана.
 *
 * ⚠️ «Customize for each network» нь ТАБ БИШ — Buffer-т суваг тус
 * бүрд ТУСДАА хайрцаг доошоо давхарладаг (баримтжсан).
 */
export function SocialComposer({
  post,
  onClose,
  onSaved,
}: {
  post: SocialPost | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(post?.body ?? '');
  /**
   * ⚠️ `GalleryEditor` нь `{key, url}` хосоор ажилладаг тул хоёр
   * төлөв барина. Backend руу ЗӨВХӨН `key` явна.
   */
  const [media, setMedia] = useState<GalleryEntry[]>(
    (post?.mediaKeys ?? []).map((k, i) => ({ key: k, url: post?.mediaUrls?.[i] ?? null })),
  );
  const mediaKeys = useMemo(() => media.map((m) => m.key), [media]);
  const [channels, setChannels] = useState<Channel[]>(
    post?.targets.map((t) => t.channel) ?? ['FACEBOOK', 'INSTAGRAM'],
  );
  const [customize, setCustomize] = useState(
    Boolean(post?.targets.some((t) => t.caption)),
  );
  const [captions, setCaptions] = useState<Partial<Record<Channel, string>>>(() => {
    const out: Partial<Record<Channel, string>> = {};
    for (const t of post?.targets ?? []) if (t.caption) out[t.channel] = t.caption;
    return out;
  });
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  /**
   * ⚠️⚠️ ТОВЛОСОН ПОСТЫН ЦАГИЙГ УНШИНА.
   *
   * БОДИТ АЛДАА: өмнө нь үргэлж `'queue'`-ээс эхэлдэг байв. Админ
   * тодорхой цагаар товлосон постоо засахад «Товлох» дарвал пост
   * тэр цагаасаа ЧИМЭЭГҮЙ дараагийн сул slot руу шилждэг байсан.
   */
  const [when, setWhen] = useState<'queue' | 'custom' | 'draft'>(() => {
    if (!post || post.status === 'DRAFT') return 'queue';
    return post.scheduleKind === 'CUSTOM' ? 'custom' : 'queue';
  });
  /**
   * ДАХИН НИЙТЛЭХ (evergreen) — Publer-ийн загвар.
   * ⚠️ Backend бүрэн бэлэн байсан ч UI байхгүй тул ХҮРЭХ АРГАГҮЙ байв.
   */
  const [recycleOn, setRecycleOn] = useState(Boolean(post?.recycle?.gap));
  const [recycleGap, setRecycleGap] = useState(String(post?.recycle?.gap ?? 2));
  const [recycleFreq, setRecycleFreq] = useState(post?.recycle?.freq ?? 'WEEK');
  const [recycleCount, setRecycleCount] = useState(String(post?.recycle?.expireCount ?? 5));
  /**
   * ⚠️⚠️ ТОГТМОЛ ГАРАГ+ЦАГ — «Мягмар бүр өглөө 07:00».
   * Заавал биш: хоосон бол давталт нь ДАРААЛЛЫН сул цаг руу орно.
   */
  const [recycleFixed, setRecycleFixed] = useState(post?.recycle?.time != null);
  const [recycleWeekday, setRecycleWeekday] = useState(String(post?.recycle?.weekday ?? 2));
  const [recycleTime, setRecycleTime] = useState(post?.recycle?.time ?? '07:00');

  /**
   * ⚠️⚠️ УЛААНБААТАРЫН цагаар. `datetime-local` нь browser-ийн бүсээр
   * ажилладаг тул `utcToUbInput` / `ubInputToUtc`-ээр л хөрвүүлнэ —
   * эс бөгөөс гадаадаас нэвтэрсэн админд цаг чимээгүй зөрнө.
   */
  const [customAt, setCustomAt] = useState(() =>
    post?.scheduledAt ? utcToUbInput(new Date(post.scheduledAt)) : '',
  );

  /**
   * ⚠️ Валидацийг СЕРВЭРЭЭС — нэг эх сурвалж. Client талд давхардуулж
   * бичвэл backend-тэй зөрж, «хадгалагдсан ч товлогдохгүй» болно.
   */
  useEffect(() => {
    if (!channels.length) {
      setIssues([]);
      return;
    }
    const t = setTimeout(() => {
      api<{ issues: ValidationIssue[] }>('/admin/social/validate', {
        method: 'POST',
        body: JSON.stringify({ body, mediaKeys, channels, captions }),
      })
        .then((r) => setIssues(r.issues))
        .catch(() => setIssues([]));
    }, 400);
    return () => clearTimeout(t);
  }, [body, mediaKeys, channels, captions]);

  const blocking = useMemo(() => issues.filter((i) => i.level === 'block'), [issues]);
  const warnings = useMemo(() => issues.filter((i) => i.level === 'warn'), [issues]);

  const toggleChannel = (ch: Channel) =>
    setChannels((c) => (c.includes(ch) ? c.filter((x) => x !== ch) : [...c, ch]));

  const captionFor = (ch: Channel) => (customize ? (captions[ch] ?? body) : body);

  const save = async (action: 'draft' | 'schedule') => {
    if (!channels.length) {
      toast.error('Дор хаяж нэг суваг сонгоно уу');
      return;
    }
    if (action === 'schedule' && blocking.length) {
      toast.error('Товлохын өмнө алдааг засна уу');
      return;
    }
    if (action === 'schedule' && when === 'custom' && !customAt) {
      toast.error('Огноо сонгоно уу');
      return;
    }

    setSaving(true);
    try {
      const saved = await api<{ post: { id: string } }>('/admin/social/posts', {
        method: 'POST',
        body: JSON.stringify({
          id: post?.id,
          body,
          mediaKeys,
          channels,
          captions: customize ? captions : undefined,
          recycle: recycleOn
            ? {
                gap: Math.max(1, Number(recycleGap) || 2),
                freq: recycleFreq,
                expireCount: Math.max(1, Number(recycleCount) || 5),
                /* ⚠️ Тогтмол цаг сонгосон үед л илгээнэ — эс бөгөөс
                   дараалалд орох горим хэвээр */
                ...(recycleFixed
                  ? { weekday: Number(recycleWeekday), time: recycleTime }
                  : {}),
                /* ⚠️ `done` хадгалагдана — засварлахад тоолуур тэглэгдэхгүй */
                done: post?.recycle?.done ?? 0,
              }
            : null,
        }),
      });

      if (action === 'schedule') {
        await api(`/admin/social/posts/${saved.post.id}/schedule`, {
          method: 'POST',
          body: JSON.stringify(
            /* ⚠️ Огноогүй = дараагийн сул slot (Buffer «Next Available») */
            when === 'custom' ? { at: ubInputToUtc(customAt).toISOString() } : {},
          ),
        });
        toast.success(when === 'queue' ? 'Дараалалд орлоо' : 'Товлогдлоо');
      } else {
        /**
         * ⚠️⚠️ ТОВЛОЛТЫГ ЦУЦЛАНА.
         *
         * БОДИТ АЛДАА: товлосон постыг «Ноорог хадгалах» дарахад
         * `schedule` дуудагдахгүй тул пост `SCHEDULED` төлөвтэй,
         * `scheduledAt` хэвээр үлддэг байв — UI «ноорог» гэж хэлэх
         * атал cron нь цагт нь ИЛГЭЭДЭГ.
         */
        if (post && post.status === 'SCHEDULED') {
          await api(`/admin/social/posts/${saved.post.id}/unschedule`, { method: 'POST' }).catch(
            () => null,
          );
        }
        toast.success('Ноорог хадгалагдлаа');
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{post ? 'Пост засах' : 'Шинэ пост'}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* ── 1) Суваг сонгох ── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Суваг
            </p>
            <div className="flex flex-wrap gap-2">
              {(['FACEBOOK', 'INSTAGRAM'] as const).map((ch) => {
                const m = CHANNEL_META[ch];
                const Icon = m.Icon;
                const on = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                      on
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <input type="checkbox" checked={on} readOnly className="h-4 w-4 accent-primary" />
                    <Icon size={15} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 2) Үндсэн текст ── */}
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Юу нийтлэх вэ?"
              className="admin-input w-full resize-y"
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={customize}
                  onChange={(e) => setCustomize(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                Суваг тус бүрд өөр текст
              </label>
              <CharCount text={body} channels={channels} />
            </div>
          </div>

          {/*
            ── 3) Суваг тус бүрийн текст ──
            ⚠️ Buffer-т эдгээр нь ТАБ биш, доошоо ДАВХАРЛАСАН хайрцаг.
            Ингэснээр админ хоёуланг зэрэг харна.
          */}
          {customize &&
            channels.map((ch) => {
              const m = CHANNEL_META[ch];
              const Icon = m.Icon;
              return (
                <div key={ch} className="rounded-lg border border-border p-3">
                  <p className={cn('mb-1.5 flex w-fit items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold', m.cls)}>
                    <Icon size={12} /> {m.label}
                  </p>
                  <textarea
                    value={captions[ch] ?? body}
                    onChange={(e) => setCaptions((c) => ({ ...c, [ch]: e.target.value }))}
                    rows={4}
                    className="admin-input w-full resize-y"
                  />
                  <div className="mt-1 flex justify-end">
                    <CharCount text={captionFor(ch)} channels={[ch]} />
                  </div>
                </div>
              );
            })}

          {/* ── 4) Медиа ── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Зураг / Видео
            </p>
            {/* ⚠️ IG carousel дээд тал нь 10 — валидаци backend талд ч бий */}
            <GalleryEditor images={media} onChange={setMedia} />
          </div>

          {/* ── 5) Шалгалт ── */}
          {blocking.length > 0 && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/8 p-3">
              {blocking.map((i, k) => (
                <p key={k} className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{CHANNEL_META[i.channel].label}:</strong> {i.message}
                  </span>
                </p>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-warning/25 bg-warning/8 p-3">
              {warnings.map((i, k) => (
                <p key={k} className="flex items-start gap-1.5 text-xs text-warning">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{CHANNEL_META[i.channel].label}:</strong> {i.message}
                  </span>
                </p>
              ))}
            </div>
          )}

          {/* ── 6) Урьдчилан харах ── */}
          {channels.length > 0 && (body.trim() || mediaKeys.length > 0) && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Урьдчилан харах
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {channels.map((ch) => (
                  <Preview
                    key={ch}
                    channel={ch}
                    text={captionFor(ch)}
                    /* ⚠️ БОДИТ зураг — харьцааны асуудлыг урьдчилж харна */
                    mediaUrl={media[0]?.url ?? null}
                    /* ⚠️ Видео эсэхийг ДАМЖУУЛНА — `<img>` нь .mp4-ыг
                       харуулж чадахгүй, хоосон дөрвөлжин гарна */
                    mediaIsVideo={media[0] ? isVideoEntry(media[0]) : false}
                    mediaCount={media.length}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── 7) Хэзээ ── */}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Хэзээ нийтлэх
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { k: 'queue', label: 'Дараалалд', hint: 'Дараагийн сул цаг' },
                  { k: 'custom', label: 'Тодорхой цаг', hint: '' },
                  { k: 'draft', label: 'Ноорог', hint: 'Товлохгүй' },
                ] as const
              ).map((o) => (
                <button
                  key={o.k}
                  onClick={() => setWhen(o.k)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                    when === o.k
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {o.label}
                  {o.hint && <span className="ml-1 font-normal opacity-70">· {o.hint}</span>}
                </button>
              ))}
            </div>
            {when === 'custom' && (
              <div className="mt-2 space-y-1">
                <input
                  type="datetime-local"
                  value={customAt}
                  onChange={(e) => setCustomAt(e.target.value)}
                  className="admin-input w-full sm:w-64"
                />
                {/* ⚠️ Цагийн бүсийг ИЛ — таамаглуулахгүй */}
                <p className="text-[11px] text-muted-foreground">
                  Цаг: {UB_LABEL}
                  {browserOffsetDiffersFromUb() && (
                    <span className="ml-1 font-medium text-warning">
                      · таны төхөөрөмжийн цагаас өөр
                    </span>
                  )}
                </p>
              </div>
            )}
            {when === 'queue' && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Sparkles size={11} />
                Хуваарийн дараагийн сул цагт орно. Хуваарь өөрчлөгдвөл ДАГАЖ шилжинэ.
              </p>
            )}
          </div>

          {/*
            ── 8) ДАХИН НИЙТЛЭХ (evergreen) ──
            ⚠️ Кино сайтад тохиромжтой: «шинэ анги гарлаа» гэсэн пост
            хэдэн долоо хоногт дахин эргэлдэж шинэ үзэгч татна.
          */}
          <div className="rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={recycleOn}
                onChange={(e) => setRecycleOn(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Тогтмол давтах
              </span>
            </label>

            {recycleOn && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={1}
                    value={recycleGap}
                    onChange={(e) => setRecycleGap(e.target.value)}
                    className="admin-input w-16"
                  />
                  <select
                    value={recycleFreq}
                    onChange={(e) => setRecycleFreq(e.target.value as 'DAY' | 'WEEK' | 'MONTH')}
                    className="admin-input w-28"
                  >
                    <option value="DAY">хоног</option>
                    <option value="WEEK">долоо хоног</option>
                    <option value="MONTH">сар</option>
                  </select>
                  <span className="text-muted-foreground">тутам,</span>
                  <input
                    type="number"
                    min={1}
                    value={recycleCount}
                    onChange={(e) => setRecycleCount(e.target.value)}
                    className="admin-input w-16"
                  />
                  <span className="text-muted-foreground">удаа давтаад зогсоно</span>
                </div>

                {/* ⚠️⚠️ ТОГТМОЛ ГАРАГ+ЦАГ — «Мягмар бүр өглөө 07:00».
                    Идэвхгүй үед давталт нь дарааллын сул цаг руу орно. */}
                <label className="mt-2.5 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recycleFixed}
                    onChange={(e) => setRecycleFixed(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    Тогтмол гараг, цагт нийтлэх
                  </span>
                </label>

                {recycleFixed && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <select
                      value={recycleWeekday}
                      onChange={(e) => setRecycleWeekday(e.target.value)}
                      className="admin-input w-32"
                    >
                      {['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'].map(
                        (w, i) => (
                          <option key={i} value={i}>
                            {w} гараг
                          </option>
                        ),
                      )}
                    </select>
                    <input
                      type="time"
                      value={recycleTime}
                      onChange={(e) => setRecycleTime(e.target.value)}
                      className="admin-input w-28"
                    />
                    <span className="text-[11px] text-muted-foreground">{UB_LABEL}</span>
                  </div>
                )}

                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  ⚠️ Давтах бүрд ХУУЛБАР үүснэ — анхны пост хэвээр үлдэнэ
                  (түүх, статистик алдагдахгүй).{' '}
                  {recycleFixed
                    ? 'Хуулбар нь заасан гараг/цагт товлогдоно.'
                    : 'Хуулбар нь дараагийн сул цагт орно.'}
                  {post?.recycle?.done ? ` Одоогоор ${post.recycle.done} удаа давтсан.` : ''}
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Товчнууд ── */}
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <button onClick={onClose} className="btn-secondary">
            Хаах
          </button>
          <button onClick={() => save('draft')} disabled={saving} className="btn-secondary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Ноорог хадгалах
          </button>
          <button
            onClick={() => save('schedule')}
            disabled={saving || blocking.length > 0 || when === 'draft'}
            title={blocking.length ? 'Эхлээд алдааг засна уу' : undefined}
            className="btn-primary"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            {when === 'queue' ? 'Дараалалд нэмэх' : 'Товлох'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Тэмдэгт тоолуур — суваг тус бүрийн хязгаараар */
function CharCount({ text, channels }: { text: string; channels: Channel[] }) {
  const igSelected = channels.includes('INSTAGRAM');
  /* ⚠️ IG нь хамгийн хатуу (2200) — түүнийг харуулна */
  if (!igSelected) {
    return <span className="text-[11px] text-muted-foreground">{text.length} тэмдэгт</span>;
  }
  const over = text.length > IG_CAPTION_MAX;
  return (
    <span className={cn('text-[11px] tabular-nums', over ? 'font-bold text-destructive' : 'text-muted-foreground')}>
      {text.length} / {IG_CAPTION_MAX}
    </span>
  );
}

/**
 * Урьдчилан харах — «дэлгэрэнгүй» шугамыг ХАРУУЛНА.
 *
 * ⚠️ IG дээр ~125, FB дээр ~477 тэмдэгтийн дараа эвхэгддэг. Админ
 * хамгийн чухал өгүүлбэрээ эхэнд бичих ёстойг харуулна.
 */
function Preview({
  channel,
  text,
  mediaUrl,
  mediaIsVideo,
  mediaCount,
}: {
  channel: Channel;
  text: string;
  mediaUrl: string | null;
  mediaIsVideo: boolean;
  mediaCount: number;
}) {
  const m = CHANNEL_META[channel];
  const Icon = m.Icon;
  const fold = channel === 'INSTAGRAM' ? IG_FOLD : FB_FOLD;
  const visible = text.slice(0, fold);
  const hidden = text.slice(fold);
  const isIg = channel === 'INSTAGRAM';

  return (
    <div className="rounded-lg border border-border bg-accent/20 p-2.5">
      <p className={cn('mb-1.5 flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold', m.cls)}>
        <Icon size={10} /> {m.label}
      </p>
      {mediaCount > 0 && (
        <div className="relative mb-1.5 overflow-hidden rounded bg-muted">
          {mediaUrl ? (
            /**
             * ⚠️⚠️ IG-д 4:5 ХАРЬЦААГААР харуулна — тэр нь Meta-гийн
             * ЗӨВШӨӨРӨХ дээд өндөр. Кино постер ихэвчлэн 2:3 тул
             * дээд/доод хэсэг ТАЙРАГДАНА — админ түүнийг ЭНД харах
             * ёстой, нийтэлсний дараа биш.
             */
            mediaIsVideo ? (
              /* ⚠️ `preload="metadata"` — эхний кадрыг л татна */
              <video
                src={mediaUrl}
                muted
                playsInline
                preload="metadata"
                className={cn('w-full object-cover', isIg ? 'aspect-[4/5]' : 'aspect-video')}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt=""
                className={cn('w-full object-cover', isIg ? 'aspect-[4/5]' : 'aspect-video')}
              />
            )
          ) : (
            <div className="flex h-16 items-center justify-center text-[11px] text-muted-foreground">
              {mediaCount} медиа
            </div>
          )}
          {mediaCount > 1 && (
            <span className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
              1/{mediaCount}
            </span>
          )}
          {isIg && mediaUrl && (
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
              4:5 тайралт
            </span>
          )}
        </div>
      )}
      <p className="whitespace-pre-wrap break-words text-xs text-foreground">
        {visible}
        {hidden && (
          <>
            <span className="text-muted-foreground/50">{hidden.slice(0, 40)}</span>
            <span className="ml-1 font-semibold text-muted-foreground">… дэлгэрэнгүй</span>
          </>
        )}
      </p>
    </div>
  );
}
