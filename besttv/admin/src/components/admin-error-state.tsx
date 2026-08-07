'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * API унасан үеийн төлөв — админ жагсаалт бүрд.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: админ панелийн 17 жагсаалтын НЭГ Ч нь
 * `isError`-ыг шалгадаггүй байв (grep-ээр батлагдсан). API унавал
 * `data === undefined` болж, зүгээр л ХООСОН ХҮСНЭГТ харагдана.
 * Админ "дата устсан байна!" гэж сандрах, эсвэл байгаа зүйлийг дахин
 * үүсгэж ДАВХАРДАЛ үүсгэх эрсдэлтэй.
 *
 * ⚠️ "Дахин оролдох" товч ЗААВАЛ — сүлжээний түр саатал нь хамгийн
 * түгээмэл шалтгаан бөгөөд хуудсаа бүтэн refresh хийх шаардлагагүй.
 */
export function AdminErrorState({
  error,
  onRetry,
}: {
  error?: unknown;
  /** React Query-ийн `refetch` */
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error && error.message ? error.message : 'Мэдээлэл ачаалж чадсангүй';

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/12">
        <AlertTriangle size={20} className="text-destructive" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Дата УСТААГҮЙ — сервертэй холбогдож чадсангүй.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <RefreshCw size={14} /> Дахин оролдох
        </button>
      )}
    </div>
  );
}
