'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GripVertical, Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { IconPicker, IconBadge } from '@/components/ui/icon-picker';
import type { AdminProductTypeConfig } from '@/types/admin';

function TypeFormDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: AdminProductTypeConfig | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!item;

  const [value, setValue] = useState(item?.value ?? '');
  const [label, setLabel] = useState(item?.label ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [icon, setIcon] = useState(item?.icon ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [active, setActive] = useState(item?.active ?? true);

  useEffect(() => {
    if (open) {
      setValue(item?.value ?? '');
      setLabel(item?.label ?? '');
      setDescription(item?.description ?? '');
      setIcon(item?.icon ?? '');
      setSortOrder(String(item?.sortOrder ?? 0));
      setActive(item?.active ?? true);
    }
  }, [open, item]);

  const mut = useMutation({
    mutationFn: () =>
      isEdit
        ? adminApi.productTypes.update(item!.id, { label, description: description || undefined, icon: icon || undefined, sortOrder: Number(sortOrder), active })
        : adminApi.productTypes.create({ value: value.toUpperCase(), label, description: description || undefined, icon: icon || undefined, sortOrder: Number(sortOrder), active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-types'] });
      toast.success(isEdit ? 'Шинэчлэгдлээ' : 'Нэмэгдлээ');
      onOpenChange(false);
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBadge name={icon || null} size="md" />
            {isEdit ? 'Төрөл засах' : 'Шинэ төрөл нэмэх'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Утга (value) <span className="text-destructive">*</span></Label>
              <Input
                placeholder="BUNDLE, FILE, TEMPLATE..."
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">Том үсгээр, зай байхгүй. Жнэ: BUNDLE</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Нэр (label) <span className="text-destructive">*</span></Label>
            <Input placeholder="Багц, Файл..." value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Тайлбар</Label>
            <Input placeholder="Богино тайлбар..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Дүрс (Icon)</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Эрэмбэ</Label>
              <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Идэвхтэй эсэх</Label>
              <button
                type="button"
                onClick={() => setActive((a) => !a)}
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}
              >
                {active ? <><Check className="h-3.5 w-3.5" /> Идэвхтэй</> : <><X className="h-3.5 w-3.5" /> Идэвхгүй</>}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Цуцлах</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !label.trim() || (!isEdit && !value.trim())}>
            {isEdit ? 'Хадгалах' : 'Нэмэх'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductTypesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductTypeConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProductTypeConfig | null>(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['admin', 'product-types'],
    queryFn: () => adminApi.productTypes.list(),
  });

  const toggleActive = useMutation({
    mutationFn: (t: AdminProductTypeConfig) => adminApi.productTypes.update(t.id, { active: !t.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'product-types'] }),
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.productTypes.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-types'] });
      toast.success('Устгагдлаа');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Устгахад алдаа'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Бүтээгдэхүүний төрлүүд</h1>
          <p className="text-muted-foreground">Нийт {types.length} төрөл</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Нэмэх
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded" />
                <div className="h-5 w-16 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="ml-auto h-5 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : types.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground">Төрөл байхгүй байна</div>
        ) : (
          <div className="divide-y divide-border">
            {types.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <IconBadge name={t.icon || null} size="sm" />
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground shrink-0">
                  {t.value}
                </code>
                <span className="font-medium text-sm flex-1">{t.label}</span>
                {t.description && (
                  <span className="text-xs text-muted-foreground hidden sm:block flex-1 truncate">{t.description}</span>
                )}
                <Badge
                  variant={t.active ? 'default' : 'secondary'}
                  className="cursor-pointer select-none shrink-0"
                  onClick={() => toggleActive.mutate(t)}
                >
                  {t.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditing(t); setDialogOpen(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TypeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Устгах уу?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <code className="text-xs bg-muted px-1 rounded">{deleteTarget?.value}</code> — &quot;{deleteTarget?.label}&quot; төрлийг устгана.
            </p>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              ⚠️ Энэ төрлийг сонгосон бүтээгдэхүүнүүд <strong>төрөлгүй</strong> болно. Бүтээгдэхүүнүүдийг урьдчилан шилжүүлэхийг зөвлөж байна.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
