'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Label,
  Loading,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';

export default function SeoPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    siteName: '',
    siteUrl: '',
    supportEmail: '',
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.settings.get(),
  });

  useEffect(() => {
    if (data?.site) {
      setForm({
        siteName: data.site.siteName,
        siteUrl: data.site.siteUrl,
        supportEmail: data.site.supportEmail ?? '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => adminApi.settings.updateSite(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Site тохиргоо хадгалагдлаа');
    },
    onError: () => toast.error('Хадгалахад алдаа'),
  });

  if (isLoading) return <Loading label="SEO..." />;
  if (isError)
    return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SEO & Site</h1>
        <p className="text-muted-foreground">Сайтын нэр, URL, дэмжлэг</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Site settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="siteName">Сайтын нэр</Label>
              <Input
                id="siteName"
                value={form.siteName}
                onChange={(e) =>
                  setForm({ ...form, siteName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="siteUrl">URL</Label>
              <Input
                id="siteUrl"
                value={form.siteUrl}
                onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support">Support email</Label>
              <Input
                id="support"
                type="email"
                value={form.supportEmail}
                onChange={(e) =>
                  setForm({ ...form, supportEmail: e.target.value })
                }
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
