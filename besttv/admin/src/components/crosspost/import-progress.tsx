'use client';

/**
 * ИМПОРТЫН ЯВЦЫН ЦОНХ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: 25 пост импортлоход медиа бүрийг Meta-гаас
 * татаж R2 руу байршуулна — постонд 2-5 секунд, нийт 1-2 минут. Энэ
 * хугацаанд ямар ч хариу байхгүй бол админ:
 *   • «гацсан уу» гэж эргэлзэж хуудсаа refresh дарна → ажил тасарна
 *   • хэд нь болсныг мэдэхгүй тул дахин импортлож ДАВХАРДУУЛНА
 *
 * Тиймээс мөр бүрийн төлөвийг БОДИТООР харуулна.
 */

import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '@besttv/shared';

export type ImportRowState = 'WAIT' | 'RUN' | 'OK' | 'FAIL';

export interface ImportRow {
  fbPostId: string;
  /** Постын эхний мөр — админ алийг нь боловсруулж байгааг таньна */
  label: string;
  state: ImportRowState;
  error?: string;
  /** IMAGE / VIDEO / TEXT — видео нь ХАМААГҮЙ удаан */
  kind?: string;
  /** Хэдэн медиа татах ёстой (урьдчилан мэдэгдэнэ) */
  mediaTotal?: number;
  /** Хэд нь татагдсан */
  mediaOk?: number;
  mediaFailed?: number;
  /** Татсан хэмжээ (байт) */
  bytes?: number;
}

/** Байт → «12.4 МБ» */
function mb(bytes?: number): string {
  if (!bytes) return '';
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} МБ`
    : `${Math.round(bytes / 1024)} КБ`;
}

export function ImportProgress({
  rows,
  done,
  onClose,
  onCancel,
  cancelling,
}: {
  rows: ImportRow[];
  /** Бүх мөр дуусаж, хаах боломжтой болсон эсэх */
  done: boolean;
  onClose: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const total = rows.length;
  const ok = rows.filter((r) => r.state === 'OK').length;
  const fail = rows.filter((r) => r.state === 'FAIL').length;
  const finished = ok + fail;
  const pct = total ? Math.round((finished / total) * 100) : 0;

  /* ⚠️ Видеоны тоо — админ «яагаад удаж байна» гэдгийг ойлгоно */
  const videos = rows.filter((r) => r.kind === 'VIDEO').length;
  const doneBytes = rows.reduce((n, r) => n + (r.bytes ?? 0), 0);
  const running = rows.find((r) => r.state === 'RUN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* ── Толгой ── */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">
            {done ? 'Импорт дууслаа' : 'Товлогч руу импортлож байна…'}
          </p>
          {/* ⚠️ Дуусаагүй үед ХААХ товч БАЙХГҮЙ — санамсаргүй хаавал
              явцаа хараад чадахгүй болно. Оронд нь «Зогсоох». */}
          {done && (
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Явцын мөр ── */}
        <div className="border-b border-border px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium tabular-nums">
              {finished} / {total}
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {ok > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 size={11} /> {ok}
                </span>
              )}
              {fail > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle size={11} /> {fail}
                </span>
              )}
              <span className="tabular-nums">{pct}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-accent">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                fail && finished === total ? 'bg-warning' : 'bg-primary',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* ⚠️ ЮУ БОЛЖ БАЙГААГ тодорхой хэлнэ — видео татах нь
              удаан тул «гацсан уу» гэж эргэлзэхээс сэргийлнэ */}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {!done && running && (
              <p className="truncate">
                <span className="font-medium text-foreground">
                  {running.kind === 'VIDEO' ? '🎬 Видео' : '🖼 Зураг'} татаж байна:
                </span>{' '}
                {running.label || '(текстгүй)'}
              </p>
            )}
            <p>
              {videos > 0 && `${videos} видео · `}
              {doneBytes > 0 && `${mb(doneBytes)} татсан`}
              {!done && videos > 0 && ' · видео том тул удаж болно'}
            </p>
            {!done && <p>⚠️ Хуудсыг хаахгүй байна уу.</p>}
          </div>
        </div>

        {/* ── Мөр бүрийн төлөв ── */}
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {rows.map((r) => (
            <div
              key={r.fbPostId}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors',
                r.state === 'RUN'
                  ? 'border-primary/40 bg-primary/5'
                  : r.state === 'FAIL'
                    ? 'border-destructive/35 bg-destructive/5'
                    : 'border-transparent',
              )}
            >
              <span className="mt-0.5 shrink-0">
                {r.state === 'OK' ? (
                  <CheckCircle2 size={13} className="text-success" />
                ) : r.state === 'FAIL' ? (
                  <XCircle size={13} className="text-destructive" />
                ) : r.state === 'RUN' ? (
                  <Loader2 size={13} className="animate-spin text-primary" />
                ) : (
                  <span className="block h-[13px] w-[13px] rounded-full border border-border" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate',
                    r.state === 'WAIT' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {r.label || '(текстгүй)'}
                </p>
                {/* ⚠️ Медиагийн бодит явц — «1/1 · 12.4 МБ» */}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                  {r.kind && (
                    <span
                      className={cn(
                        'rounded px-1 py-px font-bold',
                        r.kind === 'VIDEO'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-accent text-muted-foreground',
                      )}
                    >
                      {r.kind === 'VIDEO' ? 'ВИДЕО' : r.kind === 'IMAGE' ? 'ЗУРАГ' : r.kind}
                    </span>
                  )}
                  {r.state === 'OK' ? (
                    <>
                      <span>
                        медиа {r.mediaOk ?? 0}/{r.mediaTotal ?? 0}
                      </span>
                      {r.bytes ? <span>{mb(r.bytes)}</span> : null}
                      {r.mediaFailed ? (
                        <span className="text-warning">{r.mediaFailed} медиа унав</span>
                      ) : null}
                    </>
                  ) : r.mediaTotal ? (
                    <span>{r.mediaTotal} медиа</span>
                  ) : null}
                </p>
                {r.error && (
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-destructive">
                    <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                    {r.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Товчнууд ── */}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          {done ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Хаах
            </button>
          ) : (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {/* ⚠️ Явж буй хүсэлтийг таслахгүй — дараагийнхыг л зогсооно.
                  Эс бөгөөс хагас татагдсан медиа R2-д хог болно. */}
              {cancelling ? 'Зогсоож байна…' : 'Зогсоох'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
