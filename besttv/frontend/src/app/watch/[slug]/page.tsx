import { Suspense } from 'react';
import { WatchClient } from './watch-client';

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <WatchClient slug={slug} />
    </Suspense>
  );
}
