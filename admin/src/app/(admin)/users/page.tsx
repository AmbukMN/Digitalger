'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import type { UserRole } from '@digitalger/shared';
import {
  Badge,
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
import { Download, ShoppingCart } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { AdminUser } from '@/types/admin';

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
    mutationFn: () =>
      adminApi.users.update(editing!.id, { name: editName, role: editRole, phone: editPhone || undefined }),
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
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(row.original.name ?? row.original.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{row.original.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Эрх',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="w-fit">
              {u.role === 'ADMIN' ? 'Админ' : 'Хэрэглэгч'}
            </Badge>
            {u.isGuest && (
              <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0 text-muted-foreground">
                Зочин
              </Badge>
            )}
            {u.oauthProvider && (
              <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0 capitalize text-muted-foreground">
                {u.oauthProvider}
              </Badge>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm text-muted-foreground" title="Захиалга">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span>{u._count?.orders ?? 0}</span>
            </div>
            {(u._count?.downloads != null) && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground" title="Татаалт">
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>{u._count.downloads}</span>
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
          <div>
            <p className="text-sm">{d.toLocaleDateString('mn-MN')}</p>
            <p className="text-xs text-muted-foreground">
              {d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEdit(row.original)}
        >
          Засах
        </Button>
      ),
    },
  ];

  if (isLoading) return <Loading label="Хэрэглэгчид..." />;
  if (isError)
    return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Хэрэглэгч</h1>
          <p className="text-muted-foreground">Нийт {data?.total ?? 0}</p>
        </div>
      </div>

      <Input
        placeholder="Хайх (нэр, и-мэйл)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <DataTable columns={columns} data={data?.items ?? []} />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Хэрэглэгч засах</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">И-мэйл</p>
              <p className="font-medium">{editing?.email}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="editName">Нэр</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Нэр"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Утасны дугаар</Label>
              <Input
                id="editPhone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+976..."
              />
            </div>
            <div className="space-y-2">
              <Label>Эрх</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Хэрэглэгч</SelectItem>
                  <SelectItem value="ADMIN">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Цуцлах
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
