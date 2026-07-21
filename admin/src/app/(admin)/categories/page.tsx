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
import { Pencil, Trash2 } from 'lucide-react';
import { adminApi, errMsg } from '@/lib/api';
import { useCurrentAdmin } from '@/hooks/use-current-admin';
import type { AdminCategory } from '@/types/admin';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const { canModify } = useCurrentAdmin();

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
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа')),
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
      cell: ({ row }) =>
        // Зөвхөн өөрийн (эсвэл SUPERADMIN) ангиллын edit/delete
        canModify(row.original) ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => { setEditing(row.original); setSheetOpen(true); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-red-50 dark:bg-red-950/40"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <span className="text-[10px] italic text-muted-foreground/70" title="Өөр админы контент">
              Өөр админ
            </span>
          </div>
        ),
    },
  ];

  if (isLoading) return <Loading label="Ангиллууд..." />;
  if (isError)
    return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Ангилал</h1>
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
