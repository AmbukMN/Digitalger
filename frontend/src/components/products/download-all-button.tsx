'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@digitalger/shared/ui';
import { API_URL } from '@/lib/constants';

export function DownloadAllButton({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  async function handleDownloadAll() {
    if (!session?.accessToken) {
      toast.error('Нэвтэрч орно уу');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/downloads/zip/${productId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Татахад алдаа гарлаа');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `files-${productId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Бүх файл татагдлаа');
    } catch (e: any) {
      toast.error(e.message ?? 'Татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-xs"
      onClick={handleDownloadAll}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Бүгдийг татах
    </Button>
  );
}
