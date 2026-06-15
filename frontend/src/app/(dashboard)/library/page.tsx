'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState, Loading } from '@digitalger/shared/ui';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code,
  Download,
  DownloadCloud,
  File,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Music,
  Package,
  RefreshCw,
  Type,
  Video,
  XCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'sonner';
import { downloadsApi } from '@/lib/api';
import { triggerFileDownload } from '@/lib/download-helper';
import { useProductTypes } from '@/hooks/use-product-types';
import { Pagination } from '@/components/ui/pagination';
import { ProductRowItem } from '@/components/ui/product-row-item';

const PAGE_SIZE = 6;

type ZipState = 'idle' | 'pending' | 'queued' | 'done' | 'failed';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 120_000;


function getFileIconMeta(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf')
    return { Icon: FileText, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40' };
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext))
    return { Icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' };
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext))
    return { Icon: Video, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' };
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext))
    return { Icon: Music, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/40' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
    return { Icon: ImageIcon, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/40' };
  if (['doc', 'docx'].includes(ext))
    return { Icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' };
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return { Icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' };
  if (['ppt', 'pptx'].includes(ext))
    return { Icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40' };
  if (['fig', 'psd', 'ai', 'eps', 'sketch', 'xd'].includes(ext))
    return { Icon: Layers, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/40' };
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext))
    return { Icon: Type, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' };
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'php', 'json'].includes(ext))
    return { Icon: Code, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/40' };
  return { Icon: File, color: 'text-muted-foreground', bg: 'bg-muted' };
}

interface LibBundle {
  id: string;
  title: string;
  description?: string | null;
  downloadFileKey?: string | null;
  items: {
    id: string;
    name: string;
    description?: string | null;
    label?: string | null;
    fileId?: string | null;
    fileIds: string[];
  }[];
}

function BundleSection({
  bundles,
  productId,
  token,
  zipStates,
  downloading,
  onBundleZip,
  onFileDownload,
  zipLabel,
  zipIcon,
}: {
  bundles: LibBundle[];
  productId: string;
  token: string;
  zipStates: Record<string, ZipState>;
  downloading: string | null;
  onBundleZip: (key: string, productId: string, bundleId: string, title: string, dlKey?: string | null) => void;
  onFileDownload: (fileId: string, fileName: string) => void;
  zipLabel: (s: ZipState) => string;
  zipIcon: (s: ZipState) => React.ReactNode;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bundles.map((b) => [b.id, false])),
  );

  return (
    <div className="divide-y divide-border">
      {bundles.map((bundle, bi) => {
        const bundleKey = `bundle-${bundle.id}`;
        const bState = zipStates[bundleKey] ?? 'idle';
        const bBusy = bState === 'pending' || bState === 'queued';
        const allFileIds = bundle.items.flatMap((item) =>
          item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
        );
        const hasBundleFiles = allFileIds.length > 0 || !!bundle.downloadFileKey;

        return (
          <div key={bundle.id}>
            {/* Bundle header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpen((p) => ({ ...p, [bundle.id]: !p[bundle.id] }))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((p) => ({ ...p, [bundle.id]: !p[bundle.id] })); } }}
              className="flex items-center gap-3 px-4 py-2.5 bg-muted hover:bg-muted/70 transition-colors cursor-pointer select-none"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {bi + 1}
              </span>
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-semibold text-sm flex-1 truncate">{bundle.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">{bundle.items.length} зүйл</span>
              {hasBundleFiles && (
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                  disabled={bBusy}
                  onClick={(e) => { e.stopPropagation(); onBundleZip(bundleKey, productId, bundle.id, bundle.title, bundle.downloadFileKey); }}
                >
                  {zipIcon(bState)}
                  {zipLabel(bState) === 'Бүгдийг татах' ? 'Бүлгээр татах' : zipLabel(bState)}
                </Button>
              )}
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open[bundle.id] ? 'rotate-180' : ''}`} />
            </div>

            {/* Bundle items */}
            {open[bundle.id] && (
              <ul className="bg-muted/10 dark:bg-muted/5">
                {bundle.items.map((item, ii) => {
                  const itemFileIds = item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [];
                  return (
                    <li key={item.id} className="border-t border-border/40 px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{ii + 1}.</span>
                        <span className="flex-1 truncate font-medium">{item.name}</span>
                        {item.label && (
                          <span className="shrink-0 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-semibold text-primary">{item.label}</span>
                        )}
                        {itemFileIds.length === 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-primary hover:text-primary hover:bg-muted/70"
                            disabled={downloading === itemFileIds[0]}
                            onClick={() => onFileDownload(itemFileIds[0], item.name)}
                            aria-label="Татах"
                          >
                            {downloading === itemFileIds[0] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                      {itemFileIds.length > 1 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {itemFileIds.map((fid, fi) => (
                            <div key={fid} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1">
                              <span className="flex-1 text-xs text-muted-foreground truncate">{item.name} {fi + 1}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 text-primary hover:text-primary hover:bg-muted/70"
                                disabled={downloading === fid}
                                onClick={() => onFileDownload(fid, `${item.name}_${fi + 1}`)}
                                aria-label="Татах"
                              >
                                {downloading === fid ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ))}
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
  );
}

export default function LibraryPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [zipStates, setZipStates] = useState<Record<string, ZipState>>({});
  const { data: productTypeConfigs } = useProductTypes();

  const getTypeLabel = (type: string) => {
    const found = productTypeConfigs?.find((t) => t.value === type);
    return found?.label ?? type;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['library', token],
    queryFn: () => downloadsApi.history(token!),
    enabled: !!token,
    // "Миний сан" нь REALTIME байх ёстой — хэрэглэгч QPay төлбөр төлмөгц
    // энд шилжиж шинээр авсан бүтээгдэхүүн ШУУД харагдах ёстой. Тиймээс
    // cache-д найдахгүй: үргэлж шинээр татна (mount + таб руу буцах бүрд).
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const handleDownload = async (fileId: string, fileName: string) => {
    if (!token || downloading !== null) return;
    setDownloading(fileId);
    try {
      const result = await downloadsApi.signedUrl(token, fileId);
      // triggerFileDownload нь FB/IG доторх браузарт татахгүй, browser-switch
      // modal харуулна (FB-д <a download> "Page not found" болдог).
      triggerFileDownload(result.url, fileName);
    } catch {
      toast.error('Файл татахад алдаа гарлаа');
    } finally {
      setDownloading(null);
    }
  };

  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const pollStarted = useRef<Record<string, number>>({});

  useEffect(() => {
    const refs = pollRefs.current;
    return () => { Object.values(refs).forEach(clearInterval); };
  }, []);

  const setZipState = (key: string, s: ZipState) =>
    setZipStates((prev) => ({ ...prev, [key]: s }));

  const triggerDownload = (url: string, name: string) => triggerFileDownload(url, name);

  const handleDownloadAll = useCallback(async (
    entryKey: string,
    productId: string,
    zipName: string,
    downloadFileKey?: string | null,
    singleFileId?: string | null,
    singleFileName?: string | null,
  ) => {
    if (!token) return;
    const cur = zipStates[entryKey];
    if (cur && cur !== 'idle' && cur !== 'done' && cur !== 'failed') return;

    setZipState(entryKey, 'pending');

    // 1. Бэлэн zip файл байвал шууд татна
    if (downloadFileKey) {
      try {
        const { url, fileName } = await downloadsApi.productDownloadFile(token, productId);
        triggerDownload(url, fileName || zipName);
        setZipState(entryKey, 'done');
        setTimeout(() => setZipState(entryKey, 'idle'), 2500);
      } catch {
        setZipState(entryKey, 'failed');
        toast.error('Татахад алдаа гарлаа');
        setTimeout(() => setZipState(entryKey, 'idle'), 2500);
      }
      return;
    }

    // 2. Ганц файл байвал signed URL-р шууд татна (ZIP хийхгүй)
    if (singleFileId) {
      try {
        const result = await downloadsApi.signedUrl(token, singleFileId);
        triggerDownload(result.url, singleFileName || singleFileId);
        setZipState(entryKey, 'done');
        setTimeout(() => setZipState(entryKey, 'idle'), 2500);
      } catch {
        setZipState(entryKey, 'failed');
        toast.error('Файл татахад алдаа гарлаа');
        setTimeout(() => setZipState(entryKey, 'idle'), 2500);
      }
      return;
    }

    // 3. Олон файл → ZIP queue
    try {
      const { jobId } = await downloadsApi.enqueueProductZip(token, productId);
      setZipState(entryKey, 'queued');
      pollStarted.current[entryKey] = Date.now();

      pollRefs.current[entryKey] = setInterval(async () => {
        if (Date.now() - pollStarted.current[entryKey] > POLL_TIMEOUT) {
          clearInterval(pollRefs.current[entryKey]);
          setZipState(entryKey, 'failed');
          toast.error('Хугацаа дууслаа, дахин оролдоно уу');
          setTimeout(() => setZipState(entryKey, 'idle'), 3000);
          return;
        }
        try {
          const res = await downloadsApi.pollZipJob(token, jobId);
          if (res.status === 'DONE' && res.url) {
            clearInterval(pollRefs.current[entryKey]);
            triggerDownload(res.url, zipName);
            setZipState(entryKey, 'done');
            setTimeout(() => setZipState(entryKey, 'idle'), 2500);
          } else if (res.status === 'FAILED') {
            clearInterval(pollRefs.current[entryKey]);
            setZipState(entryKey, 'failed');
            toast.error('ZIP үүсгэхэд алдаа гарлаа');
            setTimeout(() => setZipState(entryKey, 'idle'), 3000);
          }
        } catch { /* poll retry */ }
      }, POLL_INTERVAL);
    } catch {
      setZipState(entryKey, 'failed');
      toast.error('Татахад алдаа гарлаа');
      setTimeout(() => setZipState(entryKey, 'idle'), 2500);
    }
  }, [token, zipStates]);

  const handleBundleDownloadAll = useCallback(async (
    bundleKey: string,
    productId: string,
    bundleId: string,
    bundleTitle: string,
    downloadFileKey?: string | null,
  ) => {
    if (!token) return;
    const cur = zipStates[bundleKey];
    if (cur && cur !== 'idle' && cur !== 'done' && cur !== 'failed') return;

    setZipState(bundleKey, 'pending');
    const zipName = `${bundleTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;

    if (downloadFileKey) {
      try {
        const { url, fileName } = await downloadsApi.bundleDownloadFile(token, bundleId);
        triggerDownload(url, fileName || zipName);
        setZipState(bundleKey, 'done');
        setTimeout(() => setZipState(bundleKey, 'idle'), 2500);
      } catch {
        setZipState(bundleKey, 'failed');
        toast.error('Татахад алдаа гарлаа');
        setTimeout(() => setZipState(bundleKey, 'idle'), 2500);
      }
      return;
    }

    try {
      const { jobId } = await downloadsApi.enqueueBundleZip(token, productId, bundleId);
      setZipState(bundleKey, 'queued');
      pollStarted.current[bundleKey] = Date.now();

      pollRefs.current[bundleKey] = setInterval(async () => {
        if (Date.now() - pollStarted.current[bundleKey] > POLL_TIMEOUT) {
          clearInterval(pollRefs.current[bundleKey]);
          setZipState(bundleKey, 'failed');
          toast.error('Хугацаа дууслаа, дахин оролдоно уу');
          setTimeout(() => setZipState(bundleKey, 'idle'), 3000);
          return;
        }
        try {
          const res = await downloadsApi.pollZipJob(token, jobId);
          if (res.status === 'DONE' && res.url) {
            clearInterval(pollRefs.current[bundleKey]);
            triggerDownload(res.url, zipName);
            setZipState(bundleKey, 'done');
            setTimeout(() => setZipState(bundleKey, 'idle'), 2500);
          } else if (res.status === 'FAILED') {
            clearInterval(pollRefs.current[bundleKey]);
            setZipState(bundleKey, 'failed');
            toast.error('ZIP үүсгэхэд алдаа гарлаа');
            setTimeout(() => setZipState(bundleKey, 'idle'), 3000);
          }
        } catch { /* poll retry */ }
      }, POLL_INTERVAL);
    } catch {
      setZipState(bundleKey, 'failed');
      toast.error('Татахад алдаа гарлаа');
      setTimeout(() => setZipState(bundleKey, 'idle'), 2500);
    }
  }, [token, zipStates]);

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Миний сан</h1>
          <p className="mt-1 text-sm text-muted-foreground">Таны бүх худалдан авалт — нэн даруй татах боломжтой</p>
        </div>
        {data && data.length > 0 && (
          <span className="mt-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {data.length} бүтээгдэхүүн
          </span>
        )}
      </div>

      {isLoading && <Loading className="mt-8" />}
      {error && (
        <EmptyState title="Ачаалж чадсангүй" description="Дахин оролдоно уу" className="mt-8" />
      )}

      {data && data.length === 0 && (
        <EmptyState
          title="Таны сан хоосон байна"
          description="Худалдан авсан бүтээгдэхүүнүүд энд хадгалагдана. Одоо эхлэхэд хэзээнээс ч хожуу биш."
          className="mt-8"
          action={
            <Button asChild>
              <Link href="/products">Бүтээгдэхүүн сонгох</Link>
            </Button>
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((entry) => {
            const entryKey = `${entry.orderId}-${entry.product.id}`;
            const zipState = zipStates[entryKey] ?? 'idle';
            const zipBusy = zipState === 'pending' || zipState === 'queued';
            const hasFiles = entry.product.files.length > 0;
            const hasBundles = (entry.product.bundles?.length ?? 0) > 0;
            const showFlatFiles = hasFiles;
            // Admin "Бүгдийг татах"-д бэлэн zip (downloadFileKey) оруулсан байж болно —
            // нэг нэгээр файл/bundle байхгүй ч энэ zip-ийг шууд татах товч гарах ёстой.
            const hasZip = !!entry.product.downloadFileKey;
            const canDownloadAll = hasFiles || hasBundles || hasZip;
            const zipName = `${entry.product.slug ?? entry.product.id}.zip`;

            // ── Хандалтын хугацаа (accessType=DAYS) ──────────────────────────
            // isExpired бол татах/үзэх идэвхгүй + "Дахин худалдан авах". Идэвхтэй
            // хугацаатай бол үлдсэн хоног/дуусах огноо харуулна.
            const isExpired = entry.isExpired === true;
            const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
            const daysLeft =
              expiresAt && !isExpired
                ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
                : null;
            const expiresDateStr = expiresAt
              ? expiresAt.toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
              : null;

            // Нийт татах боломжтой файлын тоо тооцоол
            const allBundleFileIds = (entry.product.bundles ?? []).flatMap((b: LibBundle) =>
              b.items.flatMap((item) => item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [])
            );
            const totalFileCount = entry.product.files.length + allBundleFileIds.length;
            // Ганц файл байвал шууд татах (ZIP хийхгүй)
            const isSingleFile = !entry.product.downloadFileKey && totalFileCount === 1;
            const singleFileId = isSingleFile
              ? (entry.product.files[0]?.id ?? allBundleFileIds[0] ?? null)
              : null;
            const singleFileName = isSingleFile
              ? (entry.product.files[0]?.fileName ?? null)
              : null;

            const zipLabel = (st: ZipState) => {
              if (st === 'pending') return 'Бэлдэж байна...';
              if (st === 'queued') return 'ZIP үүсгэж байна...';
              if (st === 'done') return 'Татагдлаа';
              if (st === 'failed') return 'Алдаа гарлаа';
              return 'Бүгдийг татах';
            };

            const zipIcon = (st: ZipState) => {
              if (st === 'done') return <CheckCircle2 className="h-3.5 w-3.5" />;
              if (st === 'failed') return <XCircle className="h-3.5 w-3.5" />;
              if (st === 'pending' || st === 'queued') return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
              return <DownloadCloud className="h-3.5 w-3.5" />;
            };

            return (
              <div
                key={entryKey}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Product header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border-b border-border">
                  <div className="min-w-0 flex-1">
                    <ProductRowItem
                      thumbnail={entry.product.thumbnailUrl}
                      title={entry.product.title}
                      titleHref={`/products/${entry.product.slug}`}
                      badge={
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {getTypeLabel(entry.product.type)}
                        </span>
                      }
                      meta={
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
                            #{entry.orderId.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.purchasedAt).toLocaleDateString('mn-MN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                            -нд авсан
                          </span>
                          {/* Хандалтын хугацааны badge */}
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                              <Clock className="h-3 w-3" />
                              Хугацаа дууссан
                            </span>
                          ) : daysLeft != null ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                daysLeft <= 7
                                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                  : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {daysLeft} хоног үлдсэн
                            </span>
                          ) : null}
                        </div>
                      }
                    />
                  </div>
                  {/* Хугацаа дууссан бол "Дахин худалдан авах", эс бол "Бүгдийг татах" */}
                  {isExpired ? (
                    <Button
                      asChild
                      size="sm"
                      className="shrink-0 gap-1.5 hidden sm:flex bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Link href={`/products/${entry.product.slug}`}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Дахин худалдан авах
                      </Link>
                    </Button>
                  ) : canDownloadAll && (
                    <Button
                      size="sm"
                      className="shrink-0 gap-1.5 hidden sm:flex bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                      disabled={zipBusy}
                      onClick={() => handleDownloadAll(entryKey, entry.product.id, zipName, entry.product.downloadFileKey, singleFileId, singleFileName)}
                    >
                      {zipIcon(zipState)}
                      {isSingleFile ? 'Татах' : zipLabel(zipState)}
                    </Button>
                  )}
                </div>

                {/* Хугацаа дууссан бол файл/татах товч идэвхгүй — дахин авах CTA */}
                {isExpired ? (
                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
                        <Clock className="h-4.5 w-4.5 text-red-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          Ашиглах хугацаа дууссан
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {expiresDateStr
                            ? `${expiresDateStr}-нд хандалт дууссан. `
                            : ''}
                          Татах/үзэх эрхийг сэргээхийн тулд дахин худалдан авна уу.
                        </p>
                      </div>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className="shrink-0 gap-1.5 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Link href={`/products/${entry.product.slug}`}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Дахин худалдан авах
                      </Link>
                    </Button>
                  </div>
                ) : (
                <>
                {/* Bundles accordion */}
                {hasBundles && (
                  <BundleSection
                    bundles={entry.product.bundles!}
                    productId={entry.product.id}
                    token={token!}
                    zipStates={zipStates}
                    downloading={downloading}
                    onBundleZip={handleBundleDownloadAll}
                    onFileDownload={handleDownload}
                    zipLabel={zipLabel}
                    zipIcon={zipIcon}
                  />
                )}

                {/* Flat files — bundle байсан ч үргэлж харуулна */}
                {showFlatFiles && (
                  <>
                    {hasBundles && (
                      <div className="px-4 pt-3 pb-1 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Файлууд</p>
                      </div>
                    )}
                    <ul className={entry.product.files.length > 5 ? 'max-h-64 overflow-y-auto' : ''}>
                      {entry.product.files.map((file, idx) => {
                        const { Icon, color, bg } = getFileIconMeta(file.fileName);
                        return (
                          <li
                            key={file.id}
                            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors ${
                              idx < entry.product.files.length - 1 ? 'border-b border-border/50' : ''
                            }`}
                          >
                            <div className="ml-2 flex items-center gap-0.5 shrink-0 text-border">
                              <div className="w-px h-4 bg-current" />
                              <div className="w-2 h-px bg-current" />
                            </div>
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                              <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                            <span className="flex-1 truncate text-sm">{file.fileName}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="shrink-0 h-8 w-8 text-primary hover:text-primary hover:bg-muted/70 dark:text-secondary dark:hover:text-secondary dark:hover:bg-secondary/10"
                              disabled={downloading === file.id}
                              onClick={() => handleDownload(file.id, file.fileName)}
                              aria-label="Татах"
                            >
                              {downloading === file.id ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent inline-block" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {/* Файл/bundle/zip огт байхгүй үед л "файл байхгүй" гэж харуулна.
                    Зөвхөн zip (downloadFileKey) байвал дээрх "Бүгдийг татах" товч хангалттай. */}
                {!showFlatFiles && !hasBundles && !hasZip && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Энэ бүтээгдэхүүнд татах файл байхгүй байна</p>
                )}

                {/* Зөвхөн zip байгаа (нэг нэгээр файл/bundle байхгүй) үед desktop дээр
                    header-ийн товчоор хангалттай ч, мэдээлэл өгөхөөр мөр нэмнэ */}
                {!showFlatFiles && !hasBundles && hasZip && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                      <DownloadCloud className="h-4 w-4 text-primary" />
                    </div>
                    <span className="flex-1 text-sm text-muted-foreground">
                      Бүх файлыг нэг багцаар татаж авна уу.
                    </span>
                  </div>
                )}

                {/* Mobile: all download button */}
                {canDownloadAll && (
                  <div className="px-4 py-2.5 border-t border-border/50 sm:hidden">
                    <Button
                      size="sm"
                      className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                      disabled={zipBusy}
                      onClick={() => handleDownloadAll(entryKey, entry.product.id, zipName, entry.product.downloadFileKey, singleFileId, singleFileName)}
                    >
                      {zipIcon(zipState)}
                      {isSingleFile ? 'Татах' : zipLabel(zipState)}
                    </Button>
                  </div>
                )}
                </>
                )}
              </div>
            );
          })}
          <Pagination
            page={page}
            total={data.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}
