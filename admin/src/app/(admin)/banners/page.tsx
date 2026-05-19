'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, EyeOff, Images } from 'lucide-react';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle, ErrorState, Loading } from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { AdminBanner } from '@/types/admin';
import { BannerFormDialog } from '@/components/banners/banner-form-dialog';

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBanner | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: () => adminApi.banners.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.banners.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
      toast.success('Баннер устгагдлаа');
    },
    onError: () => toast.error('Устгахад алдаа'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminApi.banners.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] }),
  });

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (b: AdminBanner) => { setEditing(b); setDialogOpen(true); };

  if (isLoading) return <Loading label="Баннер ачаалж байна..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Баннер</h1>
          <p className="text-muted-foreground">Нүүр хуудасны баннер удирдах</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Баннер нэмэх
        </Button>
      </div>

      {!data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Images className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Баннер байхгүй байна</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Анхны баннер нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.map((banner) => (
            <Card key={banner.id} className={banner.active ? '' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={banner.imageUrl}
                      alt={banner.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{banner.title}</span>
                      <Badge variant={banner.active ? 'default' : 'secondary'}>
                        {banner.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </Badge>
                    </div>
                    {banner.subtitle && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{banner.subtitle}</p>
                    )}
                    {banner.linkUrl && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        → {banner.linkUrl}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Дараалал: {banner.sortOrder}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleMutation.mutate({ id: banner.id, active: !banner.active })}
                      title={banner.active ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                    >
                      {banner.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(banner)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Баннер устгах уу?')) deleteMutation.mutate(banner.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BannerFormDialog
        open={dialogOpen}
        banner={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
        }}
      />
    </div>
  );
}
