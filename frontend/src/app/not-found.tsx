import Link from 'next/link';
import { Button, EmptyState } from '@digitalger/shared/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <EmptyState
        title="404 — Олдсонгүй"
        description="Хүссэн хуудас байхгүй эсвил устгагдсан байж болно."
        action={
          <Button asChild>
            <Link href="/">Нүүр рүү буцах</Link>
          </Button>
        }
      />
    </main>
  );
}
