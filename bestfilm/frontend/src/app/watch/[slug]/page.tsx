import { Suspense } from 'react';
import { WatchClient } from './watch-client';
import { WatchSkeleton } from '@/components/page-skeletons';

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<WatchSkeleton />}>
      <WatchClient slug={slug} />
    </Suspense>
  );
}
