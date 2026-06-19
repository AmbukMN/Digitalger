'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { PlayCircle } from 'lucide-react';
import { helpApi } from '@/lib/api';
import { ProductHelpVideo } from '@/components/products/product-help-video';

/**
 * Бүтээгдэхүүний хуудасны "Худалдаж авах, татах заавар видео".
 * ⚠️ Дэлгэцээс хамаарч: mobile (<768px) → platform='mobile' видео,
 *    desktop → platform='desktop' видео. Сургалтад (LESSON) огт харуулахгүй
 *    (parent дээр шалгасан). platform='all' нь Help panel-д, энд харуулахгүй.
 */
export function ProductInstructionVideo({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data: videos = [] } = useQuery({
    queryKey: ['help', 'videos'],
    queryFn: () => helpApi.videos(),
    staleTime: 5 * 60_000,
  });

  // Дэлгэцэд тохирох заавар видео (platform=desktop/mobile). all нь энд орохгүй.
  const want = isMobile ? 'mobile' : 'desktop';
  const list = videos.filter((v) => v.platform === want);
  if (list.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <PlayCircle className="h-5 w-5 text-primary" />
        Бүтээгдэхүүн худалдаж авах, татах заавар видео
      </h2>
      <div className="space-y-4">
        {list.map((v) => (
          <ProductHelpVideo key={v.id} video={v} userId={session?.user?.id} />
        ))}
      </div>
    </section>
  );
}
