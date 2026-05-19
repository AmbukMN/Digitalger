'use client';

import { Button, Input } from '@digitalger/shared/ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  return (
    <form
      className="mx-auto mt-8 flex max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-10 text-base"
          placeholder="Файл, загвар, курс хайх..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg">
        Хайх
      </Button>
    </form>
  );
}
