import { Suspense } from 'react';
import { SearchResults } from './search-results';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background pt-28" />}>
      <SearchResults />
    </Suspense>
  );
}
