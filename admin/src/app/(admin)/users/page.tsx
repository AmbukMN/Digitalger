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
import { adminApi } from '@/lib/api';
import type { AdminUser } from '@/types/admin';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminApi.users.list({ search: search || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.users.update(editing!.id, { name: editName, role: editRole }),
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
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'ADMIN' ? 'default' : 'secondary'}>
          {row.original.role === 'ADMIN' ? 'Админ' : 'Хэрэглэгч'}
        </Badge>
      ),
    },
    {
      id: 'orders',
      header: 'Захиалга',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original._count?.orders ?? 0}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Бүртгүүлсэн',
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString('mn-MN'),
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
