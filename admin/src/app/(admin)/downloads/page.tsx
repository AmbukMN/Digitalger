'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Download, Search, X, User as UserIcon, Globe } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminDownloadLog } from '@/types/admin';

// ─── source badge (Үнэгүй / Төлбөртэй / Багц) ─────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    free: { label: 'Үнэгүй', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    paid: { label: 'Төлбөртэй', cls: 'bg-muted text-primary border-primary/20' },
    bundle: { label: 'Багц', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  };
  const m = map[source] ?? { label: source, cls: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── userAgent-ийг товчоор (browser / OS) ────────────────────────────────────
function shortUserAgent(ua: string | null): string {
  if (!ua) return '—';
  let os = '';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
  else if (/mac os|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let br = '';
  if (/edg\//i.test(ua)) br = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) br = 'Chrome';
  else if (/firefox\//i.test(ua)) br = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) br = 'Safari';

  const parts = [br, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Бусад';
}

export default function DownloadsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Бүтээгдэхүүн шүүлтийн dropdown
  const { data: productsData } = useQuery({
    queryKey: ['admin', 'downloads-product-filter'],
    queryFn: () => adminApi.products.list({ page: 1, pageSize: 1000 }),
    staleTime: 5 * 60 * 1000,
  });
  const products = productsData?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'downloads', { page, pageSize, debouncedSearch, productId, source, dateFrom, dateTo }],
    queryFn: () =>
      adminApi.downloads.list({
        page,
        pageSize,
        q: debouncedSearch || undefined,
        productId: productId || undefined,
        source: source || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const total = data?.total ?? 0;
  const items: AdminDownloadLog[] = data?.items ?? [];

  const hasFilter = !!(search || productId || source || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" /> Таталт
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Бүх таталтын түүх — хэн, хэзээ, хаанаас, ямар замаар татсан ({total})
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Хэрэглэгч, имэйл, IP хайх..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={productId || 'all'}
              onValueChange={(v) => {
                setProductId(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Бүтээгдэхүүн" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх бүтээгдэхүүн</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={source || 'all'}
              onValueChange={(v) => {
                setSource(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Төрөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төрөл</SelectItem>
                <SelectItem value="free">Үнэгүй</SelectItem>
                <SelectItem value="paid">Төлбөртэй</SelectItem>
                <SelectItem value="bundle">Багц</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              title="Эхлэх огноо"
            />
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              title="Дуусах огноо"
            />
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setProductId('');
                  setSource('');
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Ачаалж байна...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Таталт олдсонгүй</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Бүтээгдэхүүн</th>
                    <th className="px-4 py-2.5 font-medium">Хэн</th>
                    <th className="px-4 py-2.5 font-medium">Төрөл</th>
                    <th className="px-4 py-2.5 font-medium">Файл</th>
                    <th className="px-4 py-2.5 font-medium">IP</th>
                    <th className="px-4 py-2.5 font-medium">Төхөөрөмж</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Огноо</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const isGuest = !r.user;
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-4 py-2.5 max-w-56">
                          {r.product ? (
                            <span className="font-medium line-clamp-1" title={r.product.title}>
                              {r.product.title}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {isGuest ? (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Globe className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs">Зочин ({r.ip ?? 'IP алга'})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-start gap-1.5">
                              <UserIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block font-medium line-clamp-1">
                                  {r.user?.name || r.user?.email || 'Хэрэглэгч'}
                                </span>
                                {r.user?.name && r.user?.email && (
                                  <span className="block text-xs text-muted-foreground/70 line-clamp-1">
                                    {r.user.email}
                                  </span>
                                )}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <SourceBadge source={r.source} />
                        </td>
                        <td className="px-4 py-2.5 max-w-56">
                          <span className="line-clamp-1 text-muted-foreground" title={r.fileName ?? ''}>
                            {r.fileName || <span className="italic opacity-60">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {r.ip || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground" title={r.userAgent ?? ''}>
                          {shortUserAgent(r.userAgent)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleString('mn-MN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
