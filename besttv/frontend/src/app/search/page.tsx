import { Suspense } from 'react';
import { SearchResults } from './search-results';
import { CatalogSkeleton } from '@/components/page-skeletons';

export default function SearchPage() {
  return (
    <Suspense fallback={<CatalogSkeleton chips={0} />}>
      <SearchResults />
    </Suspense>
  );
}
