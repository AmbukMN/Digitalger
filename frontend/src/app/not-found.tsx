import Link from 'next/link';
import { Button, EmptyState } from '@digitalger/shared/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <EmptyState
        title="Хуудас олдсонгүй"
        description="Уучлаарай, энэ хуудас байхгүй эсвэл устгагдсан байж болно. Нүүр хуудас руу буцаад эргэн хайна уу."
        action={
          <Button asChild>
            <Link href="/">Нүүр хуудас руу буцах</Link>
          </Button>
        }
      />
    </main>
  );
}
