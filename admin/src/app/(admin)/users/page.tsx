'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import type { UserRole } from '@digitalger/shared';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@digitalger/shared/ui';
import { Ban, Download, Gift, Pencil, Search, ShoppingCart, Shield, Trash2, User, CheckCircle2 } from 'lucide-react';
import { GrantProductsDialog } from '@/components/grant-products-dialog';
import { UserDetailDialog } from '@/components/user-detail-dialog';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminUser } from '@/types/admin';

const DEFAULT_PAGE_SIZE = 50;

function UserAvatar({ user, size = 8 }: { user: AdminUser; size?: number }) {
  const initials = (user.name ?? user.email).charAt(0).toUpperCase();
  const sz = `h-${size} w-${size}`;
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name ?? user.email}
        className={`${sz} rounded-full object-cover ring-2 ring-border shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
        <Shield className="h-3 w-3" />Админ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <User className="h-3 w-3" />Хэрэглэгч
    </span>
  );
}

// "Хэрэглэгч" = frontend хэрэглэгчийн цэвэр жагсаалт. Багийн админ (staff)
// нь тусдаа /staff route руу зөөгдсөн (Тохиргоо групп, зөвхөн SUPERADMIN).
export default function UsersPage() {
  return <UserListTab />;
}

function UserListTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');
  const [newPassword, setNewPassword] = useState('');
  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminUser | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', search, page, pageSize],
    queryFn: () => adminApi.users.list({ search: search || undefined, page, pageSize }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    // Админ нь нэр/утас/email/role-ийг verify-гүйгээр шууд засна.
    // Нууц үг оруулсан бол түүнийг ч шууд тохируулна.
    mutationFn: async () => {
      await adminApi.users.update(editing!.id, {
        name: editName,
        role: editRole,
        phone: editPhone || undefined,
        email: editEmail.trim() || undefined,
      });
      if (newPassword.trim()) {
        await adminApi.users.setPassword(editing!.id, newPassword.trim());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Хэрэглэгч шинэчлэгдлээ');
      setEditing(null);
      setNewPassword('');
    },
    onError: (e: any) => {
      const raw = e?.message ?? '';
      if (raw.toLowerCase().includes('имэйл') || raw.toLowerCase().includes('email'))
        toast.error('Энэ имэйл өөр хэрэглэгчид бүртгэлтэй байна');
      else if (raw.toLowerCase().includes('утас') || raw.toLowerCase().includes('phone'))
        toast.error('Энэ утас өөр хэрэглэгчид бүртгэлтэй байна');
      else if (raw.includes('8 тэмдэгт')) toast.error('Нууц үг хамгийн багадаа 8 тэмдэгт');
      else if (raw.includes('OAuth')) toast.error('OAuth бүртгэлд нууц үг тохируулах боломжгүй');
      else toast.error('Хадгалахад алдаа');
    },
  });

  const blockMutation = useMutation({
    mutationFn: (u: AdminUser) => adminApi.users.block(u.id, !u.blocked),
    onSuccess: (_, u) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(u.blocked ? 'Хэрэглэгч идэвхжүүлэгдлээ' : 'Хэрэглэгч хаагдлаа');
      setBlockTarget(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Алдаа гарлаа'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Хэрэглэгч устгагдлаа');
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Алдаа гарлаа'),
  });

  function openEdit(user: AdminUser) {
    setEditing(user);
    setEditName(user.name ?? '');
    setEditPhone(user.phone ?? '');
    // Зочны guest_xxx@guest.digitalger.mn имэйлийг хоосон харуулна
    setEditEmail(user.isGuest ? '' : user.email ?? '');
    setEditRole(user.role);
    setNewPassword('');
  }

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'user',
      header: 'Хэрэглэгч',
      cell: ({ row }) => {
        const u = row.original;
        return (
          // Нэр/зураг дээр дарахад дэлгэрэнгүй popup нээгдэнэ
          <button
            type="button"
            onClick={() => setDetailTarget(u)}
            className="flex items-center gap-3 min-w-0 text-left rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-muted/60 group cursor-pointer"
            title="Дэлгэрэнгүй харах"
          >
            <div className="relative shrink-0">
              <UserAvatar user={u} size={9} />
              {u.blocked && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive ring-2 ring-background">
                  <Ban className="h-2 w-2 text-destructive-foreground" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate leading-tight group-hover:text-primary transition-colors">{u.name ?? <span className="text-muted-foreground font-normal">Нэргүй</span>}</p>
                {u.blocked && (
                  <span className="inline-flex rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive shrink-0">Хаагдсан</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
            </div>
          </button>
        );
      },
    },
    {
      id: 'role',
      header: 'Эрх',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-col gap-1.5">
            <RoleBadge role={u.role} />
            {u.isGuest && (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground w-fit">
                Зочин
              </span>
            )}
            {u.oauthProvider && (
              <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] text-blue-700 dark:text-blue-400 capitalize w-fit">
                {u.oauthProvider}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'activity',
      header: 'Үйл ажиллагаа',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium tabular-nums">{u._count?.orders ?? 0}</span>
              <span className="text-xs text-muted-foreground">захиалга</span>
            </div>
            {(u._count?.downloads ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{u._count?.downloads}</span>
                <span>таталт</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Бүртгүүлсэн',
      cell: ({ row }) => {
        const d = new Date(row.original.createdAt);
        return (
          <div className="whitespace-nowrap">
            <p className="text-xs font-medium">{d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
            <p className="text-[10px] text-muted-foreground">{d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const u = row.original;
        const isAdmin = u.role === 'ADMIN';
        return (
          <div className="flex items-center gap-1">
            {/* Gift (бүтээгдэхүүн идэвхжүүлэх) — admin өөртөө ч grant хийж болно
                (худалдсан үеийн харагдацыг шалгах, test хийх). */}
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-primary/70 hover:text-primary hover:bg-primary/10"
              onClick={() => setGrantTarget(u)}
              title={isAdmin ? 'Өөртөө бүтээгдэхүүн идэвхжүүлэх (тест)' : 'Бүтээгдэхүүн идэвхжүүлэх'}
            >
              <Gift className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => openEdit(u)} title="Засах"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {!isAdmin && (
              <>
                <Button
                  variant="ghost" size="icon"
                  className={`h-7 w-7 ${u.blocked ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950' : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950'}`}
                  onClick={() => setBlockTarget(u)}
                  title={u.blocked ? 'Идэвхжүүлэх' : 'Хаах'}
                >
                  {u.blocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(u)} title="Устгах"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (isLoading) return <Loading label="Хэрэглэгчид..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Хэрэглэгч</h1>
          <p className="text-sm text-muted-foreground">Нийт {data?.total ?? 0} хэрэглэгч</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Нэр, и-мэйл, утас..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <DataTable columns={columns} data={data?.items ?? []} pageSize={pageSize} />
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
      />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Хэрэглэгч засах</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <UserAvatar user={editing} size={10} />
              <div>
                <p className="text-sm font-semibold">{editing.name ?? 'Нэргүй'}</p>
                <p className="text-xs text-muted-foreground">{editing.email}</p>
              </div>
            </div>
          )}
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="editName">Нэр</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Нэр" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editPhone">Утасны дугаар</Label>
              <Input id="editPhone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+976..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editEmail">И-мэйл</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={!!editing?.oauthProvider}
                className={editing?.oauthProvider ? 'bg-muted' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {editing?.oauthProvider
                  ? 'OAuth бүртгэлийн имэйлийг засах боломжгүй'
                  : 'Админ имэйлийг баталгаажуулалтгүйгээр шууд солино'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Эрх</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Хэрэглэгч</SelectItem>
                  <SelectItem value="ADMIN">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editing?.oauthProvider && (
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Шинэ нууц үг (заавал биш)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Хоосон бол өөрчлөхгүй"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Бичвэл хэрэглэгчийн нууц үг шууд солигдоно (8+ тэмдэгт)
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Цуцлах</Button>
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block/Unblock confirm dialog */}
      <Dialog open={!!blockTarget} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{blockTarget?.blocked ? 'Хэрэглэгч идэвхжүүлэх үү?' : 'Хэрэглэгч хаах уу?'}</DialogTitle>
          </DialogHeader>
          {blockTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <UserAvatar user={blockTarget} size={9} />
              <div>
                <p className="text-sm font-semibold">{blockTarget.name ?? 'Нэргүй'}</p>
                <p className="text-xs text-muted-foreground">{blockTarget.email}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {blockTarget?.blocked
              ? 'Хэрэглэгч дахин нэвтрэх боломжтой болно.'
              : 'Хаагдсаны дараа тухайн хэрэглэгч системд нэвтрэх боломжгүй болно.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockTarget(null)}>Цуцлах</Button>
            <Button
              variant={blockTarget?.blocked ? 'default' : 'destructive'}
              disabled={blockMutation.isPending}
              onClick={() => blockTarget && blockMutation.mutate(blockTarget)}
            >
              {blockMutation.isPending ? 'Түр хүлээнэ үү...' : blockTarget?.blocked ? 'Идэвхжүүлэх' : 'Хаах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Хэрэглэгч устгах уу?</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <UserAvatar user={deleteTarget} size={9} />
              <div>
                <p className="text-sm font-semibold">{deleteTarget.name ?? 'Нэргүй'}</p>
                <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Хэрэглэгчийн бүртгэл болон холбоотой бүх өгөгдөл бүрмөсөн устгагдана. Буцаах боломжгүй.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Бүтээгдэхүүн идэвхжүүлэх popup (multi-select + search) */}
      <GrantProductsDialog user={grantTarget} onClose={() => setGrantTarget(null)} />

      {/* Хэрэглэгчийн дэлгэрэнгүй popup (бүх дата: захиалга/татсан/үзсэн/түүх) */}
      <UserDetailDialog user={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
}
