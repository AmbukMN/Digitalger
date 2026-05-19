'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { AdminCategory } from '@/types/admin';

interface CategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AdminCategory | null;
}

const empty = { name: '', slug: '', description: '', sortOrder: '0' };

export function CategorySheet({
  open,
  onOpenChange,
  category,
}: CategorySheetProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        slug: category.slug,
        description: category.description ?? '',
        sortOrder: String(category.sortOrder),
      });
    } else {
      setForm(empty);
    }
  }, [category, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
      };
      if (category) return adminApi.categories.update(category.id, body);
      return adminApi.categories.create(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success(category ? 'Ангилал шинэчлэгдлээ' : 'Ангилал нэмэгдлээ');
      onOpenChange(false);
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {category ? 'Ангилал засах' : 'Шинэ ангилал'}
          </SheetTitle>
        </SheetHeader>
        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cat-name">Нэр</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-desc">Тайлбар</Label>
            <Input
              id="cat-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-sort">Эрэмбэ</Label>
            <Input
              id="cat-sort"
              type="number"
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: e.target.value })
              }
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
