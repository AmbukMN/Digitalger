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
import { Download, Pencil, Search, ShoppingCart, Shield, User } from 'lucide-react';
import Image from 'next/image';
import { adminApi } from '@/lib/api';
import type { AdminUser } from '@/types/admin';

function UserAvatar({ user, size = 8 }: { user: AdminUser; size?: number }) {
  const initials = (user.name ?? user.email).charAt(0).toUpperCase();
  const sz = `h-${size} w-${size}`;
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name ?? user.email}
        width={size * 4}
        height={size * 4}
        className={`${sz} rounded-full object-cover ring-2 ring-border shrink-0`}
        unoptimized
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

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminApi.users.list({ search: search || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: () => adminApi.users.update(editing!.id, { name: editName, role: editRole, phone: editPhone || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Хэрэглэгч шинэчлэгдлээ');
      setEditing(null);
    },
    onError: () => toast.error('Хадгалахад алдаа'),
  });

  function openEdit(user: AdminUser) {
    setEditing(user);
    setEditName(user.name ?? '');
    setEditPhone(user.phone ?? '');
    setEditRole(user.role);
  }

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'user',
      header: 'Хэрэглэгч',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar user={u} size={9} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{u.name ?? <span className="text-muted-foreground font-normal">Нэргүй</span>}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
            </div>
          </div>
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
                <span>татаалт</span>
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
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(row.original)} title="Засах">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
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
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable columns={columns} data={data?.items ?? []} />

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
              <Label>Эрх</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Хэрэглэгч</SelectItem>
                  <SelectItem value="ADMIN">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Цуцлах</Button>
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
