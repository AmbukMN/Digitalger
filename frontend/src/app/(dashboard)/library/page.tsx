'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState, Loading } from '@digitalger/shared/ui';
import {
  Archive,
  Code,
  Download,
  DownloadCloud,
  File,
  FileText,
  Image as ImageIcon,
  Layers,
  Music,
  Type,
  Video,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'sonner';
import { downloadsApi } from '@/lib/api';
import { PRODUCT_TYPE_LABELS } from '@/lib/constants';
import { Pagination } from '@/components/ui/pagination';
import { ProductRowItem } from '@/components/ui/product-row-item';

const PAGE_SIZE = 6;

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

export default function LibraryPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['library', token],
    queryFn: () => downloadsApi.history(token!),
    enabled: !!token,
  });

  const handleDownload = async (fileId: string, fileName: string) => {
    if (!token) return;
    setDownloading(fileId);
    try {
      const result = await downloadsApi.signedUrl(token, fileId);
      const a = document.createElement('a');
      a.href = result.url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error('Файл татахад алдаа гарлаа');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async (
    entryKey: string,
    files: { id: string; fileName: string }[],
  ) => {
    if (!token || !files.length) return;
    setDownloadingAll(entryKey);
    try {
      for (const file of files) {
        const result = await downloadsApi.signedUrl(token, file.id);
        const a = document.createElement('a');
        a.href = result.url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (files.length > 1) await new Promise((r) => setTimeout(r, 400));
      }
      toast.success('Бүх файл татагдаж байна...');
    } catch {
      toast.error('Татахад алдаа гарлаа');
    } finally {
      setDownloadingAll(null);
    }
  };

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Миний сан</h1>
          <p className="mt-1 text-sm text-muted-foreground">Худалдан авсан бүтээгдэхүүнүүд</p>
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
          title="Сан хоосон байна"
          description="Худалдан авсан бүтээгдэхүүн энд харагдана"
          className="mt-8"
          action={
            <Button asChild>
              <Link href="/products">Бүтээгдэхүүн үзэх</Link>
            </Button>
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((entry) => {
            const entryKey = `${entry.orderId}-${entry.product.id}`;
            const isDlAll = downloadingAll === entryKey;
            const hasFiles = entry.product.files.length > 0;
            const multiFile = entry.product.files.length > 1;

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
                          {PRODUCT_TYPE_LABELS[entry.product.type] ?? entry.product.type}
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
                        </div>
                      }
                    />
                  </div>
                  {hasFiles && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 hidden sm:flex"
                      disabled={isDlAll}
                      onClick={() => handleDownloadAll(entryKey, entry.product.files)}
                    >
                      <DownloadCloud className="h-3.5 w-3.5" />
                      {isDlAll ? 'Татаж байна...' : multiFile ? 'Бүгдийг татах' : 'Татах'}
                    </Button>
                  )}
                </div>

                {/* Files list */}
                {hasFiles ? (
                  <ul>
                    {entry.product.files.map((file, idx) => {
                      const { Icon, color, bg } = getFileIconMeta(file.fileName);
                      return (
                        <li
                          key={file.id}
                          className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors ${
                            idx < entry.product.files.length - 1
                              ? 'border-b border-border/50'
                              : ''
                          }`}
                        >
                          {/* Indent indicator */}
                          <div className="ml-2 flex items-center gap-0.5 shrink-0 text-border">
                            <div className="w-px h-4 bg-current" />
                            <div className="w-2 h-px bg-current" />
                          </div>
                          {/* File type icon */}
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}
                          >
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>
                          {/* File name */}
                          <span className="flex-1 truncate text-sm">{file.fileName}</span>
                          {/* Download button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-primary"
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
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Татах файл байхгүй</p>
                )}

                {/* Mobile: all download button */}
                {hasFiles && (
                  <div className="px-4 py-2.5 border-t border-border/50 sm:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5"
                      disabled={isDlAll}
                      onClick={() => handleDownloadAll(entryKey, entry.product.files)}
                    >
                      <DownloadCloud className="h-3.5 w-3.5" />
                      {isDlAll ? 'Татаж байна...' : multiFile ? 'Бүгдийг татах' : 'Татах'}
                    </Button>
                  </div>
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
