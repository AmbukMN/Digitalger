'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '@besttv/shared';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { TitleCard } from '@/components/title-card';
import { loginUrl } from '@/lib/auth-intent';

const AGE_CONFIRM_KEY = 'btv_age_confirmed';

export default function AdultPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState<boolean | null>(null); // null = шалгаж байна

  useEffect(() => {
    setConfirmed(sessionStorage.getItem(AGE_CONFIRM_KEY) === '1');
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adult-titles'],
    queryFn: () =>
      api<{ items: TitleCardType[]; total: number }>('/titles/adult', { auth: false }),
    enabled: confirmed === true,
  });

  const confirmAge = () => {
    sessionStorage.setItem(AGE_CONFIRM_KEY, '1');
    setConfirmed(true);
  };

  // Хуудас ачаалж дуустал хоосон дэлгэц (18+ агуулга анивчихаас сэргийлнэ)
  if (confirmed === null) return <div className="min-h-screen bg-background" />;

  if (!confirmed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert size={28} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Насны баталгаажуулалт</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Энэ хэсэгт зөвхөн насанд хүрэгчдэд зориулсан контент байрлана.
            Үргэлжлүүлснээр та <strong className="text-white/85">18 нас хүрсэн</strong> гэдгээ
            баталж байна.
          </p>

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => router.push('/')}
              className="flex-1 rounded-lg bg-white/8 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/12"
            >
              Буцах
            </button>
            <button
              onClick={confirmAge}
              className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-bold text-white transition-all hover:brightness-110"
            >
              18 нас хүрсэн
            </button>
          </div>

          <p className="mt-4 flex items-start gap-1.5 text-left text-[11px] leading-relaxed text-white/35">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            Худал мэдээлэл өгөх нь үйлчилгээний нөхцөл зөрчсөнд тооцогдоно.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
            Насанд хүрэгчдийн
          </h1>
          <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-bold text-destructive">
            18+
          </span>
        </div>
        <p className="mt-1.5 text-white/55">
          Энэ хэсгийн контент нүүр хуудас, хайлтад харагдахгүй
        </p>

        {!user && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-white/60">
            Үзэхийн тулд{' '}
            <Link href={loginUrl('/adult')} className="font-semibold text-primary hover:underline">
              нэвтэрч
            </Link>{' '}
            18+ багц авах шаардлагатай.
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {isError && (
            <div className="col-span-full">
              <ErrorState
                title="Ачаалж чадсангүй"
                message="Контентыг татаж чадсангүй."
                onRetry={() => refetch()}
              />
            </div>
          )}

          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-2/3 w-full rounded-lg" />
            ))}
          {data?.items.map((t) => <TitleCard key={t.id} title={t} inGrid />)}
        </div>

        {!isLoading && data?.items.length === 0 && (
          <div className="mt-20 text-center">
            <p className="font-semibold text-white/70">Одоогоор контент байхгүй байна</p>
            <Link
              href="/"
              className={cn(
                'mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white',
                'hover:brightness-110',
              )}
            >
              Нүүр хуудас
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
