'use client';

import { useState } from 'react';
import { ChevronDown, Download, FileText, Lock, Loader2, Package } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@digitalger/shared/ui';
import { useFileDownload } from '@/hooks/use-file-download';
import { downloadsApi } from '@/lib/api';

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
    setLoading(true);
    try {
      await download(fileId, fileName);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/15 px-2 py-1.5 mt-1">
      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="flex-1 text-xs truncate text-muted-foreground">{fileName}</span>
      {isPurchased ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs gap-1 shrink-0 text-primary hover:text-primary"
          onClick={handleDownload}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Татах
        </Button>
      ) : (
        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}

type ZipState = 'idle' | 'pending' | 'processing' | 'done' | 'failed';

function BundleZipButton({
  productId,
  bundleId,
  token,
}: {
  productId: string;
  bundleId: string;
  token: string;
}) {
  const [state, setState] = useState<ZipState>('idle');

  async function handleZip() {
    if (state === 'pending' || state === 'processing') return;
    setState('pending');
    try {
      const { jobId } = await downloadsApi.enqueueBundleZip(token, productId, bundleId);
      // Poll хүртэл done болох
      let attempts = 0;
      while (attempts < 120) {
        await new Promise((r) => setTimeout(r, 2000));
        const result = await downloadsApi.pollZipJob(token, jobId);
        if (result.status === 'DONE' && result.url) {
          setState('done');
          // Шууд татуулна
          const a = document.createElement('a');
          a.href = result.url;
          a.download = 'bundle.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => setState('idle'), 3000);
          return;
        }
        if (result.status === 'FAILED') {
          setState('failed');
          setTimeout(() => setState('idle'), 3000);
          return;
        }
        if (result.status === 'PROCESSING') setState('processing');
        attempts++;
      }
      setState('failed');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('failed');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const label =
    state === 'pending' ? 'Бэлдэж байна...' :
    state === 'processing' ? 'ZIP хийж байна...' :
    state === 'done' ? 'Татагдлаа!' :
    state === 'failed' ? 'Алдаа' :
    'ZIP татах';

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2.5 text-xs gap-1 shrink-0"
      onClick={handleZip}
      disabled={state === 'pending' || state === 'processing'}
    >
      {(state === 'pending' || state === 'processing')
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Download className="h-3 w-3" />}
      {label}
    </Button>
  );
}

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

  return (
    <section>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Багцын агуулга
      </h2>
      <div className="space-y-3">
        {bundles.map((bundle, bi) => {
          const bundleFileIds = bundle.items.flatMap((item) =>
            item.fileIds && item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
          );
          const hasBundleFiles = bundleFileIds.length > 0;

          return (
            <div key={bundle.id} className="rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(bundle.id)}
                className="w-full flex items-center gap-3 bg-primary/5 px-4 py-3 border-b border-border hover:bg-primary/10 transition-colors text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {bi + 1}
                </span>
                <span className="font-semibold text-sm flex-1">{bundle.title}</span>
                {bundle.description && (
                  <span className="text-xs text-muted-foreground hidden sm:block">{bundle.description}</span>
                )}
                <span className="text-xs text-muted-foreground shrink-0 ml-1">
                  {bundle.items.length} зүйл
                </span>
                {/* Bundle zip download button */}
                {hasBundleFiles && purchased && session?.accessToken && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <BundleZipButton
                      productId={productId}
                      bundleId={bundle.id}
                      token={session.accessToken}
                    />
                  </span>
                )}
                {hasBundleFiles && !purchased && (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open[bundle.id] ? 'rotate-180' : ''}`}
                />
              </button>
              {open[bundle.id] && (
                <ul className="divide-y divide-border">
                  {bundle.items.map((item, ii) => {
                    const itemFileIds = item.fileIds && item.fileIds.length > 0 ? item.fileIds : (item.fileId ? [item.fileId] : []);
                    const hasFiles = itemFileIds.length > 0;
                    return (
                      <li key={item.id} className="px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{ii + 1}.</span>
                          {hasFiles ? (
                            purchased
                              ? <Download className="h-4 w-4 shrink-0 text-primary" />
                              : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          )}
                          <span className="flex-1">{item.name}</span>
                          {item.label && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{item.label}</span>
                          )}
                          {item.description && (
                            <span className="text-xs text-muted-foreground hidden sm:block">{item.description}</span>
                          )}
                          {hasFiles && !purchased && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {itemFileIds.length} файл
                            </span>
                          )}
                        </div>
                        {/* Download links — only for purchasers */}
                        {hasFiles && purchased && (
                          <div className="ml-8 space-y-1 mt-1">
                            {itemFileIds.map((fid) => {
                              const info = fileMap.get(fid);
                              return (
                                <BundleFileRow
                                  key={fid}
                                  fileId={fid}
                                  fileName={info?.fileName ?? fid}
                                  isPurchased={purchased}
                                />
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
