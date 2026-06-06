'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@digitalger/shared/ui';
import { downloadsApi } from '@/lib/api';
import { triggerFileDownload } from '@/lib/download-helper';

type State = 'idle' | 'loading' | 'queued' | 'done' | 'failed';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 120_000;

export function DownloadAllButton({
  productId,
  downloadFileKey,
  zipName,
  className,
  variant = 'outline',
  label,
  free = false,
}: {
  productId: string;
  downloadFileKey?: string | null;
  zipName?: string;
  className?: string;
  variant?: 'outline' | 'default';
  label?: string;
  // free=true үед нэвтрэхгүй public endpoint-ээр (үнэгүй бүтээгдэхүүн) татна
  free?: boolean;
}) {
  const { data: session } = useSession();
  const [state, setState] = useState<State>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(0);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPoll(), []);

  const triggerDownload = (url: string, name: string) => triggerFileDownload(url, name);

  const handleClick = useCallback(async () => {
    // Үнэгүй биш горимд нэвтрэх шаардлагатай
    if (!free && !session?.accessToken) { toast.error('Нэвтэрч орно уу'); return; }
    if (state !== 'idle' && state !== 'done' && state !== 'failed') return;

    // In-app browser (FB/IG/Messenger) илэрвэл хэрэглэгчид сэрэмжлүүлнэ —
    // эдгээр браузер файл татахыг хязгаарладаг. Татах оролдлогыг үргэлжлүүлнэ
    // (window.location ажиллаж магадгүй), гэхдээ ажиллахгүй бол хэрэглэгч
    // гадаад браузераар нээх шаардлагатайг мэдэх болно.
    setState('loading');

    // Admin uploaded file — шууд presign татна
    if (downloadFileKey) {
      try {
        const { url, fileName } = free
          ? await downloadsApi.freeProductDownloadFile(productId)
          : await downloadsApi.productDownloadFile(session!.accessToken!, productId);
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
      const { jobId } = free
        ? await downloadsApi.enqueueFreeZip(productId)
        : await downloadsApi.enqueueProductZip(session!.accessToken!, productId);
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
          const res = free
            ? await downloadsApi.pollFreeZipJob(jobId)
            : await downloadsApi.pollZipJob(session!.accessToken!, jobId);
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
  }, [session, productId, downloadFileKey, zipName, state, free]);

  const icon = () => {
    if (state === 'loading' || state === 'queued') return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (state === 'done') return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (state === 'failed') return <XCircle className="h-3.5 w-3.5" />;
    return <Download className="h-3.5 w-3.5" />;
  };

  const getLabel = () => {
    if (state === 'loading') return 'Бэлдэж байна...';
    if (state === 'queued') return 'ZIP үүсгэж байна...';
    if (state === 'done') return 'Татагдлаа';
    if (state === 'failed') return 'Алдаа гарлаа';
    return label ?? 'Бүгдийг татах';
  };

  return (
    <Button
      variant={variant}
      size="sm"
      className={`gap-2 text-xs${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      disabled={state === 'loading' || state === 'queued'}
    >
      {icon()}
      {getLabel()}
    </Button>
  );
}
