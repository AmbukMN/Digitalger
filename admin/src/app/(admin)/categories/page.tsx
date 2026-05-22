'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Loading,
} from '@digitalger/shared/ui';
import { CategorySheet } from '@/components/categories/category-sheet';
import { IconBadge } from '@/components/ui/icon-picker';
import { adminApi } from '@/lib/api';
import type { AdminCategory } from '@/types/admin';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi.categories.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.categories.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Устгагдлаа');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Устгахад алдаа'),
  });

  const columns: ColumnDef<AdminCategory>[] = [
    {
      accessorKey: 'name',
      header: 'Нэр',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <IconBadge name={row.original.icon} size="sm" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'slug', header: 'Slug' },
    { accessorKey: 'sortOrder', header: 'Эрэмбэ' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setSheetOpen(true);
            }}
          >
            Засах
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget(row.original)}
          >
            Устгах
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Loading label="Ангиллууд..." />;
  if (isError)
    return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ангилал</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          + Нэмэх
        </Button>
      </div>

      <DataTable columns={columns} data={data} />

      <CategorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={editing}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ангилал устгах уу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &quot;{deleteTarget?.name}&quot; устгагдана.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Цуцлах
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
