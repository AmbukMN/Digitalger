'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@digitalger/shared/ui';
import { downloadsApi } from '@/lib/api';

type State = 'idle' | 'loading' | 'queued' | 'done' | 'failed';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 120_000;

export function DownloadAllButton({
  productId,
  downloadFileKey,
  zipName,
  className,
}: {
  productId: string;
  downloadFileKey?: string | null;
  zipName?: string;
  className?: string;
}) {
  const { data: session } = useSession();
  const [state, setState] = useState<State>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(0);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPoll(), []);

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleClick = useCallback(async () => {
    if (!session?.accessToken) { toast.error('Нэвтэрч орно уу'); return; }
    if (state !== 'idle' && state !== 'done' && state !== 'failed') return;

    setState('loading');

    // Admin uploaded file — шууд presign татна
    if (downloadFileKey) {
      try {
        const { url, fileName } = await downloadsApi.productDownloadFile(session.accessToken, productId);
        triggerDownload(url, fileName || zipName || `${productId}.zip`);
        setState('done');
        setTimeout(() => setState('idle'), 2500);
      } catch {
        setState('failed');
        toast.error('Татахад алдаа гарлаа');
        setTimeout(() => setState('idle'), 2500);
      }
      return;
    }

    // Admin file байхгүй — async ZIP queue ашиглана
    try {
      const { jobId } = await downloadsApi.enqueueProductZip(session.accessToken, productId);
      setState('queued');
      startedAt.current = Date.now();

      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt.current > POLL_TIMEOUT) {
          stopPoll();
          setState('failed');
          toast.error('Хугацаа дууслаа, дахин оролдоно уу');
          setTimeout(() => setState('idle'), 3000);
          return;
        }
        try {
          const res = await downloadsApi.pollZipJob(session.accessToken!, jobId);
          if (res.status === 'DONE' && res.url) {
            stopPoll();
            triggerDownload(res.url, zipName || `${productId}.zip`);
            setState('done');
            setTimeout(() => setState('idle'), 2500);
          } else if (res.status === 'FAILED') {
            stopPoll();
            setState('failed');
            toast.error('ZIP үүсгэхэд алдаа гарлаа');
            setTimeout(() => setState('idle'), 3000);
          }
        } catch { /* poll retry */ }
      }, POLL_INTERVAL);
    } catch {
      setState('failed');
      toast.error('Татахад алдаа гарлаа');
      setTimeout(() => setState('idle'), 2500);
    }
  }, [session, productId, downloadFileKey, zipName, state]);

  const icon = () => {
    if (state === 'loading' || state === 'queued') return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (state === 'done') return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (state === 'failed') return <XCircle className="h-3.5 w-3.5" />;
    return <Download className="h-3.5 w-3.5" />;
  };

  const label = () => {
    if (state === 'loading') return 'Бэлдэж байна...';
    if (state === 'queued') return 'ZIP үүсгэж байна...';
    if (state === 'done') return 'Татагдлаа';
    if (state === 'failed') return 'Алдаа гарлаа';
    return 'Бүгдийг татах';
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={`gap-2 text-xs${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      disabled={state === 'loading' || state === 'queued'}
    >
      {icon()}
      {label()}
    </Button>
  );
}
