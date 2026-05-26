'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronsDown, Download, Lock, Loader2, Package, CheckCircle2, XCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@digitalger/shared/ui';
import { useFileDownload } from '@/hooks/use-file-download';
import { downloadsApi } from '@/lib/api';
import { toast } from 'sonner';

interface BundleItem {
  id: string;
  name: string;
  description?: string | null;
  label?: string | null;
  fileId?: string | null;
  fileIds?: string[];
}

interface FileInfo {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

interface Bundle {
  id: string;
  title: string;
  description?: string | null;
  downloadFileKey?: string | null;
  items: BundleItem[];
}

function BundleFileRow({
  fileId,
  fileName,
  isPurchased,
}: {
  fileId: string;
  fileName: string;
  isPurchased: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { download } = useFileDownload();

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      await download(fileId, fileName);
    } finally {
      setLoading(false);
    }
  }

  if (!isPurchased) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-xs gap-1 shrink-0 text-primary hover:text-primary hover:bg-primary/10"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      Татах
    </Button>
  );
}

type DlState = 'idle' | 'loading' | 'queued' | 'done' | 'failed';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 120_000;

function BundleDownloadButton({
  bundleId,
  productId,
  bundleTitle,
  downloadFileKey,
  token,
}: {
  bundleId: string;
  productId: string;
  bundleTitle: string;
  downloadFileKey?: string | null;
  token: string;
}) {
  const [state, setState] = useState<DlState>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === 'loading' || state === 'queued') return;
    setState('loading');

    if (downloadFileKey) {
      try {
        const { url, fileName } = await downloadsApi.bundleDownloadFile(token, bundleId);
        triggerDownload(url, fileName || `${bundleTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
        setState('done');
        setTimeout(() => setState('idle'), 2500);
      } catch {
        setState('failed');
        toast.error('Татахад алдаа гарлаа');
        setTimeout(() => setState('idle'), 2500);
      }
      return;
    }

    try {
      const { jobId } = await downloadsApi.enqueueBundleZip(token, productId, bundleId);
      setState('queued');
      startedAt.current = Date.now();

      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt.current > POLL_TIMEOUT) {
          clearInterval(pollRef.current!); pollRef.current = null;
          setState('failed');
          toast.error('Хугацаа дууслаа');
          setTimeout(() => setState('idle'), 3000);
          return;
        }
        try {
          const res = await downloadsApi.pollZipJob(token, jobId);
          if (res.status === 'DONE' && res.url) {
            clearInterval(pollRef.current!); pollRef.current = null;
            triggerDownload(res.url, `${bundleTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
            setState('done');
            setTimeout(() => setState('idle'), 2500);
          } else if (res.status === 'FAILED') {
            clearInterval(pollRef.current!); pollRef.current = null;
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
  }

  const busy = state === 'loading' || state === 'queued';
  const btnLabel =
    state === 'loading' ? 'Бэлдэж байна...' :
    state === 'queued'  ? 'ZIP үүсгэж байна...' :
    state === 'done'    ? 'Татагдлаа' :
    state === 'failed'  ? 'Алдаа' :
    'Бүлгээр татах';

  return (
    <Button
      size="sm"
      variant="default"
      className="h-7 px-2.5 text-xs gap-1 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
      onClick={handleClick}
      disabled={busy}
    >
      {busy        ? <Loader2 className="h-3 w-3 animate-spin" /> :
       state === 'done'   ? <CheckCircle2 className="h-3 w-3" /> :
       state === 'failed' ? <XCircle className="h-3 w-3" /> :
       <Download className="h-3 w-3" />}
      {btnLabel}
    </Button>
  );
}

const BUNDLE_PAGE_SIZE = 20;

export function BundleList({
  bundles,
  productFiles,
  productId,
}: {
  bundles: Bundle[];
  productFiles?: FileInfo[];
  productId: string;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bundles.map((b, i) => [b.id, i === 0 && b.items.length <= 6])),
  );
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>(() =>
    Object.fromEntries(bundles.map((b) => [b.id, BUNDLE_PAGE_SIZE])),
  );

  const { data: library = [] } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  const purchased = library.some((item) => item.product.id === productId);
  const fileMap = new Map((productFiles ?? []).map((f) => [f.id, f]));

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function showMore(id: string) {
    setVisibleCount((prev) => ({ ...prev, [id]: (prev[id] ?? BUNDLE_PAGE_SIZE) + BUNDLE_PAGE_SIZE }));
  }

  return (
    <section>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Багцын агуулга
      </h2>
      <div className="space-y-3">
        {bundles.map((bundle, bi) => {
          const hasBundleFiles = bundle.items.some((item) =>
            (item.fileIds && item.fileIds.length > 0) || item.fileId,
          );
          const hasDownloadFile = !!bundle.downloadFileKey;
          const limit = visibleCount[bundle.id] ?? BUNDLE_PAGE_SIZE;
          const visibleItems = bundle.items.slice(0, limit);
          const hiddenCount = bundle.items.length - limit;

          return (
            <div key={bundle.id} className="rounded-xl border border-border overflow-hidden">
              {/* Bundle header row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggle(bundle.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(bundle.id); } }}
                className="w-full flex items-center gap-2 bg-primary/5 px-4 py-3 border-b border-border hover:bg-primary/10 transition-colors text-left cursor-pointer select-none"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {bi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-sm block break-words">{bundle.title}</span>
                  {bundle.description && (
                    <span className="text-[11px] text-muted-foreground block break-words leading-tight">{bundle.description}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {bundle.items.length} зүйл
                </span>

                {purchased && session?.accessToken && (hasBundleFiles || hasDownloadFile) && (
                  <BundleDownloadButton
                    bundleId={bundle.id}
                    productId={productId}
                    bundleTitle={bundle.title}
                    downloadFileKey={bundle.downloadFileKey}
                    token={session.accessToken}
                  />
                )}
                {!purchased && (hasBundleFiles || hasDownloadFile) && (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open[bundle.id] ? 'rotate-180' : ''}`}
                />
              </div>

              {open[bundle.id] && (
                <>
                  <ul className="divide-y divide-border">
                    {visibleItems.map((item, ii) => {
                      const itemFileIds = item.fileIds && item.fileIds.length > 0
                        ? item.fileIds
                        : (item.fileId ? [item.fileId] : []);
                      const hasFiles = itemFileIds.length > 0;

                      return (
                        <li key={item.id} className="px-4 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4 shrink-0 text-right tabular-nums">{ii + 1}.</span>
                            {hasFiles && !purchased && (
                              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            {(!hasFiles || purchased) && (
                              <span className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="flex-1 font-medium">{item.name}</span>
                            {item.label && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{item.label}</span>
                            )}
                            {item.description && (
                              <span className="text-xs text-muted-foreground hidden sm:block">{item.description}</span>
                            )}
                            {hasFiles && purchased && itemFileIds.length === 1 && (
                              <BundleFileRow
                                key={itemFileIds[0]}
                                fileId={itemFileIds[0]}
                                fileName={fileMap.get(itemFileIds[0])?.fileName ?? item.name}
                                isPurchased={true}
                              />
                            )}
                            {hasFiles && !purchased && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {itemFileIds.length} файл
                              </span>
                            )}
                          </div>
                          {hasFiles && purchased && itemFileIds.length > 1 && (
                            <div className="ml-8 space-y-1 mt-1.5">
                              {itemFileIds.map((fid) => (
                                <BundleFileRow
                                  key={fid}
                                  fileId={fid}
                                  fileName={fileMap.get(fid)?.fileName ?? fid}
                                  isPurchased={true}
                                />
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); showMore(bundle.id); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-primary dark:text-secondary hover:bg-primary/8 dark:hover:bg-secondary/10 transition-colors border-t border-border"
                    >
                      <span className="flex flex-col items-center -space-y-1.5">
                        <ChevronsDown className="h-3.5 w-3.5 animate-bounce" />
                      </span>
                      {hiddenCount} зүйл харах
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
