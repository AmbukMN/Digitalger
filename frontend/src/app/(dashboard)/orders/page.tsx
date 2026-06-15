'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, Loading } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ordersApi, paymentsApi } from '@/lib/api';
import { CheckCircle2 } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { ProductRowItem } from '@/components/ui/product-row-item';
import { QPayCheckout } from '@/components/payment/qpay-checkout';
import type { Order, PaymentInitiateResult } from '@/types/api';

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Хүлээгдэж буй',
  PAID: 'Төлсөн',
  FAILED: 'Амжилтгүй',
  REFUNDED: 'Буцаагдсан',
  CANCELLED: 'Цуцлагдсан',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  REFUNDED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  CANCELLED: 'bg-muted text-muted-foreground',
};

type FilterStatus = 'ALL' | keyof typeof STATUS_LABELS;

const FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'Бүгд' },
  { value: 'PENDING', label: 'Хүлээгдэж буй' },
  { value: 'PAID', label: 'Төлсөн' },
  { value: 'CANCELLED', label: 'Цуцлагдсан' },
  { value: 'REFUNDED', label: 'Буцаагдсан' },
  { value: 'FAILED', label: 'Амжилтгүй' },
];

function OrderCard({
  order,
  token,
  onPayClick,
}: {
  order: Order;
  token: string;
  onPayClick: (result: PaymentInitiateResult) => void;
}) {
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);

  const cancelMut = useMutation({
    mutationFn: () => ordersApi.cancel(token, order.id),
    onSuccess: () => {
      toast.success('Захиалга цуцлагдлаа');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error('Цуцлахад алдаа гарлаа'),
  });

  const handlePay = async () => {
    setPaying(true);
    try {
      const payment = await paymentsApi.initiateQPay(token, order.id);
      if (payment.devMode) {
        toast.success('Төлбөр амжилттай (dev)');
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        return;
      }
      onPayClick(payment);
    } catch {
      toast.error('Төлбөр эхлүүлж чадсангүй');
    } finally {
      setPaying(false);
    }
  };

  const date = new Date(order.createdAt).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate savings
  const savings = order.items.reduce((sum, item) => {
    const cp = Number((item.product as any).compareAtPrice ?? 0);
    const p = Number(item.price);
    return cp > p ? sum + (cp - p) : sum;
  }, 0);

  const originalTotal = order.items.reduce((sum, item) => {
    const cp = Number((item.product as any).compareAtPrice ?? 0);
    const p = Number(item.price);
    return sum + (cp > p ? cp : p);
  }, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Захиалгын дугаар
          </span>
          <span className="inline-flex items-center self-start rounded-md border border-border bg-muted/70 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-foreground">
            #{order.id.slice(-8).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] ?? STATUS_COLORS.CANCELLED}`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          <span className="text-[10px] text-muted-foreground">{date}</span>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-border/50">
        {order.items.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <ProductRowItem
              thumbnail={(item.product as any).thumbnailUrl}
              title={item.product.title}
              titleHref={`/products/${item.product.slug}`}
              price={Number(item.price)}
              compareAtPrice={
                Number((item.product as any).compareAtPrice) > Number(item.price)
                  ? Number((item.product as any).compareAtPrice)
                  : null
              }
            />
          </div>
        ))}
      </div>

      {/* Coupon badges */}
      {order.couponCode && (() => {
        const codes = order.couponCode.split(',').map((c) => c.trim()).filter(Boolean);
        const itemsTotal = order.items.reduce((sum, item) => sum + Number(item.price), 0);
        const couponDiscount = itemsTotal - Number(order.total);
        return (
          <div className="px-4 py-2.5 border-t border-border/50 bg-green-50/50 dark:bg-green-900/10 flex flex-wrap items-center gap-2">
            {codes.map((code) => (
              <span
                key={code}
                className="flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs"
              >
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                <span className="font-mono font-bold text-green-700 dark:text-green-400 tracking-wider">{code}</span>
              </span>
            ))}
            {couponDiscount > 0 && (
              <span className="text-xs text-green-600 dark:text-green-500 font-medium">
                −{formatPrice(couponDiscount)} купон хөнгөлөлт
              </span>
            )}
          </div>
        );
      })()}

      {/* Footer */}
      <div className="flex items-end justify-between gap-4 flex-wrap px-4 py-3 border-t border-border bg-muted/10">
        {/* Actions (left) */}
        {order.status === 'PENDING' ? (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-red-50 dark:bg-red-950/40 hover:text-destructive border-destructive/30"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              {cancelMut.isPending ? '...' : 'Цуцлах'}
            </Button>
            <Button size="sm" disabled={paying} onClick={handlePay}>
              {paying ? 'Уншиж байна...' : 'QPay төлөх'}
            </Button>
          </div>
        ) : (
          <span />
        )}

        {/* Price summary (right-aligned) */}
        <div className="text-right space-y-0.5">
          {savings > 0 && (
            <p className="text-xs text-muted-foreground">
              Нийт үнэ{' '}
              <span className="line-through">{formatPrice(originalTotal)}</span>
            </p>
          )}
          {savings > 0 && (
            <p className="text-xs font-medium text-green-600 dark:text-green-400">
              Хэмнэлт −{formatPrice(savings)}
            </p>
          )}
          <p className="text-base font-bold text-primary">{formatPrice(Number(order.total))}</p>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [page, setPage] = useState(1);
  const [qpayResult, setQpayResult] = useState<PaymentInitiateResult | null>(null);
  const queryClient = useQueryClient();

  // Reset page when filter changes
  const handleFilter = (v: FilterStatus) => { setFilter(v); setPage(1); };

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', token],
    // Fetch up to 100 orders so filter counts stay accurate; client-side pagination handles display
    queryFn: () => ordersApi.list(token!, 1, 100),
    enabled: !!token,
  });

  if (!session) return null;

  const allOrders = data?.items ?? [];
  const filtered = filter === 'ALL' ? allOrders : allOrders.filter((o) => o.status === filter);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts: Record<string, number> = {};
  allOrders.forEach((o) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Захиалгын Түүх</h1>
        <p className="mt-1 text-sm text-muted-foreground">Таны бүх захиалга, төлбөрийн мэдээлэл нэг дороос</p>
      </div>

      {isLoading && <Loading className="mt-8" />}
      {error && <EmptyState title="Ачаалж чадсангүй" className="mt-8" />}

      {!isLoading && !error && (
        <>
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(({ value, label }) => {
              const count = value === 'ALL' ? allOrders.length : (counts[value] ?? 0);
              if (value !== 'ALL' && count === 0) return null;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleFilter(value)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      filter === value
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-background text-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={
                filter === 'ALL'
                  ? 'Одоогоор захиалга байхгүй байна'
                  : `${STATUS_LABELS[filter]} захиалга байхгүй`
              }
              className="mt-4"
              action={
                filter === 'ALL' ? (
                  <Button asChild>
                    <Link href="/products">Бүтээгдэхүүн сонгох</Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => handleFilter('ALL')}>
                    Бүгдийг харах
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {paged.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  token={token!}
                  onPayClick={setQpayResult}
                />
              ))}
              <Pagination
                page={page}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* QPay modal */}
      {qpayResult && token && (
        <QPayCheckout
          payment={qpayResult}
          token={token}
          onSuccess={() => {
            setQpayResult(null);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }}
          onClose={() => setQpayResult(null)}
        />
      )}
    </div>
  );
}
