'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';

interface HealthIssue {
  level: 'critical' | 'warning' | 'ok';
  title: string;
  detail: string;
  href?: string;
  items?: string[];
}

interface HealthResult {
  issues: HealthIssue[];
  counts: { critical: number; warning: number };
  checkedAt: string;
}

/**
 * КОНТЕНТЫН ЭРҮҮЛ МЭНД — хянах самбарын дээд талд.
 *
 * ⚠️⚠️ ЯАГААД НҮҮР ХУУДСАНД ВЭ: backend-д шалгалт бэлэн байсан ч UI
 * байгаагүй тул админ ХЭЗЭЭ Ч харахгүй байв. «Шилдэг кино» багц
 * 9,900₮-өөр зарагдаж байгаад доторх нэг ч кино тоглохгүй байсныг
 * гараар SQL бичиж байж л илрүүлсэн — систем өөрөө хэлэх ёстой.
 *
 * ⚠️ Асуудалгүй үед НИМГЭН ногоон мөр л харагдана — самбарыг
 * бөглөрүүлэхгүй.
 */
export function ContentHealthCard() {
  const { data, isLoading, isError } = useQuery<HealthResult>({
    queryKey: ['admin-content-health'],
    queryFn: () => api<HealthResult>('/admin/analytics/health'),
    /* ⚠️ 5 минут — шалгалт нь хэдэн count query тул хөнгөн, гэхдээ
       хуудас сэргээх бүрд дуудах шаардлагагүй */
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  /* ⚠️ Ачаалж байх/унасан үед ЮУ Ч харуулахгүй — энэ нь туслах мэдээлэл
     тул алдаа гарлаа гэж админыг сандраахгүй (гол дата доор бий) */
  if (isLoading || isError || !data) return null;

  const { critical, warning } = data.counts;

  if (critical === 0 && warning === 0) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/25 bg-success/8 px-3.5 py-2.5 text-sm text-success">
        <CheckCircle2 size={16} className="shrink-0" />
        Контентын шалгалт цэвэр — бүх багц үзэх боломжтой контенттой
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-2">
      {data.issues.map((iss, i) => {
        const isCrit = iss.level === 'critical';
        const cls = cn(
          'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 transition-colors',
          isCrit
            ? 'border-destructive/30 bg-destructive/8 hover:bg-destructive/12'
            : 'border-primary/25 bg-primary/8 hover:bg-primary/12',
        );

        const body = (
          <>
            {isCrit ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
            ) : (
              <Info size={16} className="mt-0.5 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-semibold',
                  isCrit ? 'text-destructive' : 'text-foreground',
                )}
              >
                {iss.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{iss.detail}</p>
              {iss.items?.length ? (
                /* ⚠️ Нэрсийг ТАСАЛЖ харуулна — 200 кино байвал самбар эвдэрнэ */
                <p className="mt-1 truncate text-xs text-muted-foreground/70">
                  {iss.items.join(' · ')}
                </p>
              ) : null}
            </div>
            {iss.href && (
              <ChevronRight size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
            )}
          </>
        );

        /* ⚠️ `Link` нь `href`-гүй байж БОЛОХГҮЙ (TS) — динамик tag
           ашиглахын оронд салгаж бичив */
        return iss.href ? (
          <Link key={i} href={iss.href} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={i} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
