'use client';

import { useMemo, useState } from 'react';
import { TableSkeleton } from '@/components/table-skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { BulkBar, SelectBox, useBulkSelect } from '@/lib/use-bulk-select';
import { Loader2, ShieldCheck, UserCheck, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { AdminErrorState } from '@/components/admin-error-state';
import { UserDetailDialog } from '@/components/user-detail-dialog';
import { DataToolbar, SortHeader } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import { api } from '@/lib/api';
import {
  useAdminUserCounts,
  useAdminUsers,
  type AdminUser,
  type UserFilters,
} from '@/lib/queries';
import { NewBadge } from '@/components/new-badge';
import { useNewSince } from '@/lib/use-new-since';

const PROVIDER_LABEL: Record<string, string> = {
  LOCAL: 'Имэйл',
  GOOGLE: 'Google',
  FACEBOOK: 'Facebook',
  GUEST: 'Зочин',
};

const EMPTY: UserFilters = {
  q: '',
  role: 'ALL',
  status: 'ALL',
  sub: 'ALL',
  provider: 'ALL',
  from: '',
  to: '',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  limit: 20,
};

export default function UsersPage() {
  const [f, setF] = useState<UserFilters>(EMPTY);
  /* ⚠️ `isError`/`refetch` ЗААВАЛ — эс бөгөөс API унахад `data`
     undefined үлдэж skeleton МӨНХ эргэлдэнэ (доорх `!data &&` нөхцөл).
     Админ "сервер удаан байна" гэж хүлээнэ, үнэндээ 500 буцаасан. */
  const { data, isFetching, isError, error, refetch } = useAdminUsers(f);
  const { data: counts } = useAdminUserCounts({ q: f.q, from: f.from, to: f.to });
  const qc = useQueryClient();
  /* Олноор устгах — тест хэрэглэгч их хуримтлагддаг (hook давхардлыг арилгасан) */
  const sel = useBulkSelect({
    endpoint: '/admin/users/bulk-delete',
    invalidate: ['admin-users', 'admin-user-counts'],
    label: 'хэрэглэгч',
  });
  const [detailTarget, setDetailTarget] = useState<AdminUser | null>(null);
  /** ⚠️ Хуудас нээгдэх мөчид тэмдэглэсэн — badge цэвэрлэгдсэн ч мөр тэмдэглэгдэнэ */
  const isNew = useNewSince('users');

  // Давхар дарахаас сэргийлж тухайн мөрийг түр түгждэг
  const [busyId, setBusyId] = useState<string | null>(null);

  const set = (patch: Partial<UserFilters>) =>
    setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));

  const activeCount = useMemo(() => {
    let n = 0;
    if (f.role && f.role !== 'ALL') n++;
    if (f.status && f.status !== 'ALL') n++;
    if (f.sub && f.sub !== 'ALL') n++;
    if (f.provider && f.provider !== 'ALL') n++;
    if (f.from || f.to) n++;
    return n;
  }, [f]);

  const toggleSort = (field: string) =>
    set({ sort: field, dir: f.sort === field && f.dir === 'desc' ? 'asc' : 'desc' });

  const toggleActive = async (id: string, isActive: boolean) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await api(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      await qc.invalidateQueries({ queryKey: ['admin-user-counts'] });
      toast.success(isActive ? 'Хэрэглэгч хаагдлаа' : 'Хэрэглэгч нээгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Өөрчилж чадсангүй');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Хэрэглэгчид"
        subtitle={data ? `${data.total.toLocaleString()} хэрэглэгч` : undefined}
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* Товч статистик */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat icon={<Users size={17} />} label="Нийт" value={counts?.ALL ?? 0} />
          <MiniStat
            icon={<UserCheck size={17} />}
            label="Идэвхтэй"
            value={counts?.active ?? 0}
            tone="success"
          />
          <MiniStat
            icon={<Wallet size={17} />}
            label="Багцтай"
            value={counts?.withSub ?? 0}
            tone="premium"
          />
          <MiniStat
            icon={<ShieldCheck size={17} />}
            label="Хаагдсан"
            value={counts?.blocked ?? 0}
            tone="danger"
          />
        </div>

        <DataToolbar
          search={f.q ?? ''}
          onSearch={(v) => set({ q: v })}
          searchPlaceholder="Имэйл, нэр, ID-аар хайх..."
          tabs={[
            { id: 'ALL', label: 'Бүгд', count: counts?.ALL },
            { id: 'active', label: 'Идэвхтэй', count: counts?.active },
            { id: 'blocked', label: 'Хаагдсан', count: counts?.blocked },
          ]}
          activeTab={f.status}
          onTab={(id) => set({ status: id })}
          from={f.from}
          to={f.to}
          onDateRange={(from, to) => set({ from, to })}
          selects={[
            {
              id: 'sub',
              label: 'Багцын төлөв',
              value: f.sub ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'active', label: 'Идэвхтэй багцтай' },
                { value: 'none', label: 'Багцгүй' },
              ],
              onChange: (v) => set({ sub: v }),
            },
            {
              id: 'provider',
              label: 'Нэвтрэх төрөл',
              value: f.provider ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'LOCAL', label: 'Имэйл' },
                { value: 'GOOGLE', label: 'Google' },
                { value: 'FACEBOOK', label: 'Facebook' },
                { value: 'GUEST', label: 'Зочин' },
              ],
              onChange: (v) => set({ provider: v }),
            },
            {
              id: 'role',
              label: 'Эрх',
              value: f.role ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'USER', label: 'Хэрэглэгч' },
                { value: 'ADMIN', label: 'Админ' },
              ],
              onChange: (v) => set({ role: v }),
            },
          ]}
          limit={f.limit}
          onLimit={(n) => set({ limit: n })}
          activeCount={activeCount}
          onReset={() => setF(EMPTY)}
        />

        {/* ⚠️ Алдааны төлөв ЗААВАЛ хүснэгтээс ӨМНӨ — эс бөгөөс API
            унахад `!data && <TableSkeleton>` мөнх эргэлдэнэ */}
        {isError ? (
          <div className="mt-5">
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
        <div
          className={cn(
            'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
            isFetching && 'opacity-60',
          )}
        >
          <table className="w-full min-w-205 text-sm">
            <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {/* ⚠️ Bulk сонголт — тест хэрэглэгч олноор үүсдэг тул заавал */}
                <th className="w-10 px-4 py-3">
                  <SelectBox
                    checked={sel.allChecked((data?.items ?? []).map((u) => u.id))}
                    onChange={() => sel.toggleAll((data?.items ?? []).map((u) => u.id))}
                    ariaLabel="Хуудсан дээрх бүгдийг сонгох"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Хэрэглэгч</th>
                <th className="px-4 py-3 text-left font-semibold">Багц</th>
                <th className="px-4 py-3 text-left font-semibold">Нэвтрэх</th>
                <SortHeader
                  label="Хэтэвч"
                  field="walletBalance"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                  align="right"
                />
                <SortHeader
                  label="Бүртгүүлсэн"
                  field="createdAt"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.items.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <SelectBox
                      checked={sel.isSelected(u.id)}
                      onChange={() => sel.toggle(u.id)}
                      ariaLabel={`${u.email} сонгох`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailTarget(u)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-foreground hover:text-primary">
                          {u.name ?? '—'}
                          {isNew(u.createdAt) && <NewBadge />}
                          {u.role === 'ADMIN' && (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              АДМИН
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {u.activeSubscription ? (
                      <div>
                        <span className="rounded-md bg-premium/15 px-2 py-0.5 text-xs font-medium text-premium">
                          {u.activeSubscription.planName}
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(u.activeSubscription.expiresAt).toLocaleDateString('mn-MN')}{' '}
                          хүртэл
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Эрхгүй</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {PROVIDER_LABEL[u.provider] ?? u.provider}
                    </span>
                    {!u.emailVerified && u.provider === 'LOCAL' && (
                      <p className="text-[10px] text-warning">баталгаажаагүй</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        'font-medium',
                        u.walletBalance > 0 ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {formatPrice(u.walletBalance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString('mn-MN')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u.id, u.isActive)}
                      disabled={busyId === u.id}
                      title={u.isActive ? 'Дарж хаана' : 'Дарж нээнэ'}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                        u.isActive
                          ? 'bg-success/15 text-success hover:bg-success/25'
                          : 'bg-destructive/15 text-destructive hover:bg-destructive/25',
                      )}
                    >
                      {busyId === u.id && <Loader2 size={11} className="animate-spin" />}
                      {u.isActive ? 'Идэвхтэй' : 'Хаагдсан'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ⚠️ ЭХНИЙ ачаалалт — spinner БИШ skeleton (төслийн дүрэм).
              Дараагийн шүүлтэд хуучин дата `opacity-60`-той үлдэнэ. */}
          {!data && <TableSkeleton rows={8} cols={6} hasAvatar={true} />}
          {!data?.items.length && !isFetching && (
            <TableEmptyState
              icon={Users}
              message={
                activeCount > 0 || f.q
                  ? 'Шүүлтэд тохирох хэрэглэгч олдсонгүй'
                  : 'Хэрэглэгч байхгүй байна'
              }
            />
          )}
        </div>
        )}

        <Pagination
          page={data?.page ?? 1}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          limit={f.limit}
          onPage={(p) => setF((s) => ({ ...s, page: p }))}
        />
      </main>

      {detailTarget && (
        <UserDetailDialog user={detailTarget} onClose={() => setDetailTarget(null)} />
      )}

      <BulkBar {...sel.bar} />
    </AdminShell>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'success' | 'premium' | 'danger';
}) {
  return (
    <div className="admin-card flex items-center gap-3 rounded-xl p-3.5">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          tone === 'success' && 'bg-success/12 text-success',
          tone === 'premium' && 'bg-premium/12 text-premium',
          tone === 'danger' && 'bg-destructive/12 text-destructive',
          !tone && 'bg-primary/12 text-primary',
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
