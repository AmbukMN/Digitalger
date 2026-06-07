'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@digitalger/shared/ui';
import { API_URL } from '@/lib/constants';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email')?.trim() ?? '';

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUnsubscribe = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/email/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error('failed');
      }

      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (data.success === false) {
        throw new Error('failed');
      }

      setDone(true);
    } catch {
      toast.error('Алдаа гарлаа. Дараа дахин оролдоно уу.');
    } finally {
      setLoading(false);
    }
  };

  // Холбоос буруу — email query байхгүй
  if (!email) {
    return (
      <Card className="w-full max-w-md border-border/60 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Холбоос буруу байна</CardTitle>
          <CardDescription>
            Имэйл хаяг олдсонгүй. Цуцлах холбоосыг бүрэн дарж орно уу.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Нүүр хуудас руу буцах</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Амжилттай цуцалсан
  if (done) {
    return (
      <Card className="w-full max-w-md border-border/60 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">Амжилттай цуцаллаа</CardTitle>
          <CardDescription>
            Цаашид <span className="font-medium text-foreground">{email}</span>{' '}
            хаяг руу маркетингийн имэйл явуулахгүй.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg bg-muted/60 p-3 text-center text-sm text-muted-foreground">
            Худалдан авалт, төлбөрийн баталгаажуулалт зэрэг чухал имэйл хэвээр
            явагдана.
          </p>
          <div className="flex justify-center">
            <Button
              asChild
              style={{ backgroundColor: '#022179' }}
              className="text-white hover:opacity-90"
            >
              <Link href="/">Нүүр хуудас руу буцах</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Баталгаажуулах хэсэг
  return (
    <Card className="w-full max-w-md border-border/60 shadow-sm">
      <CardHeader className="text-center">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255, 190, 0, 0.15)' }}
        >
          <Mail className="h-6 w-6" style={{ color: '#022179' }} />
        </div>
        <CardTitle className="text-xl">
          Маркетингийн имэйлээс гарах
        </CardTitle>
        <CardDescription>
          Та <span className="font-medium text-foreground">{email}</span> хаягийг
          маркетингийн имэйл жагсаалтаас хасах гэж байна.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p>
            Зөвхөн{' '}
            <span className="font-medium text-foreground">маркетингийн</span>{' '}
            имэйл зогсоно. Худалдан авалт, төлбөрийн баталгаажуулалт зэрэг чухал
            (transactional) имэйл хэвээр явагдана.
          </p>
        </div>

        <Button
          onClick={handleUnsubscribe}
          disabled={loading}
          className="w-full text-white hover:opacity-90"
          style={{ backgroundColor: '#022179' }}
        >
          {loading ? 'Цуцалж байна...' : 'Цуцлахыг баталгаажуулах'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Санаа бодлоо өөрчилсөн үү?{' '}
          <Link href="/" className="font-medium text-foreground hover:underline">
            Нүүр хуудас руу буцах
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <Card className="w-full max-w-md border-border/60 shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Уншиж байна...</CardTitle>
            </CardHeader>
          </Card>
        }
      >
        <UnsubscribeContent />
      </Suspense>
    </main>
  );
}
