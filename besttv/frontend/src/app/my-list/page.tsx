'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useMyList, useTitlesByIds } from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { useMyListStore } from '@/lib/my-list-store';
import { TitleCard } from '@/components/title-card';

/**
 * Дуртай кино.
 *
 * ⚠️ ЗОЧИН ч ашиглана — localStorage-д зөвхөн id хадгална, /titles/by-ids-ээр
 * бодит киног татна. Нэвтэрсэн үед сервер дэх жагсаалт эх сурвалж болно.
 */
export default function MyListPage() {
  const { user, loading } = useAuth();
  const storeIds = useMyListStore((s) => s.ids);
  const storeLoaded = useMyListStore((s) => s.loaded);

  const server = useMyList(!!user);
  // Зочны id-ууд (нэвтэрсэн үед энэ query идэвхгүй)
  const guest = useTitlesByIds([...storeIds], storeLoaded && !user);

  const isLoading = loading || (user ? server.isLoading : !storeLoaded || guest.isLoading);

  // Store hydrate болмогц realtime эх сурвалж болгоно (устгасан item шууд алга болно)
  const source = user ? (server.data ?? []) : (guest.data ?? []);
  const items = storeLoaded ? source.filter((t) => storeIds.has(t.id)) : source;

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Дуртай кино</h1>
      <p className="mt-1.5 text-white/55">
        {user
          ? 'Хадгалсан кино'
          : 'Энэ төхөөрөмжид хадгалагдсан — нэвтрэхэд таны хаягтай холбогдоно'}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-2/3 w-full rounded-lg" />
          ))}
        {!isLoading && items.map((t) => <TitleCard key={t.id} title={t} inGrid />)}
      </div>

      {!isLoading && items.length === 0 && (
        <div className="mt-20 flex flex-col items-center text-center">
          <div className="rounded-full bg-white/6 p-5 text-white/30">
            <Heart size={32} />
          </div>
          <p className="mt-4 font-semibold text-white/70">Дуртай кино алга байна</p>
          <p className="mt-1 text-sm text-white/40">Киноны зурган дээрх ♥ товчийг дарж нэмээрэй</p>
          <Link
            href="/movies"
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Кино үзэх
          </Link>
        </div>
      )}
    </main>
  );
}
