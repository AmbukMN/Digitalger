'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, AlertCircle, CheckCircle2, Clock, RefreshCw, Trash2, Zap } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { adminApi } from '@/lib/api';
import type { QueueJobSummary } from '@/types/admin';

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function JobRow({ job, type }: { job: QueueJobSummary; type: 'failed' | 'completed' }) {
  const ts = job.finishedOn ?? job.processedOn ?? job.timestamp;
  const date = ts ? new Date(ts).toLocaleString('mn-MN') : '—';
  const payload = job.data as { zipName?: string; fileIds?: string[]; jobId?: string };

  return (
    <div className={cn('rounded-lg border p-3 text-sm', type === 'failed' ? 'border-destructive/30 bg-red-50 dark:bg-red-950/30' : 'border-border')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">Bull #{job.id}</p>
          {payload.zipName && <p className="truncate font-medium">{payload.zipName}</p>}
          {payload.fileIds && (
            <p className="text-muted-foreground">{payload.fileIds.length} файл</p>
          )}
          {type === 'failed' && job.failedReason && (
            <p className="mt-1 text-destructive text-xs line-clamp-2">{job.failedReason}</p>
          )}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  );
}

export default function QueuePage() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'queue', 'status'],
    queryFn: () => adminApi.queue.status(),
    refetchInterval: 5000,
  });

  const retryMut = useMutation({
    mutationFn: () => adminApi.queue.retryFailed(),
    onSuccess: (res) => {
      toast.success(`${res.retried} job дахин эхлүүллээ`);
      void qc.invalidateQueries({ queryKey: ['admin', 'queue'] });
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  const cleanMut = useMutation({
    mutationFn: () => adminApi.queue.clean(),
    onSuccess: () => {
      toast.success('Дараалал цэвэрлэгдлээ');
      void qc.invalidateQueries({ queryKey: ['admin', 'queue'] });
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl">ZIP Дараалал</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse bg-muted rounded pt-6" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl">ZIP Дараалал</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">Мэдээлэл татаж чадсангүй. Redis холбоос шалгана уу.</p>
            <Button variant="outline" onClick={() => void refetch()}>Дахин оролдох</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { queue, db, recentFailed, recentCompleted } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">ZIP Дараалал</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {queue.isPaused ? (
              <span className="text-destructive font-medium">Түр зогсоосон</span>
            ) : (
              <span className="text-green-600 dark:text-green-400 font-medium">Ажиллаж байна</span>
            )}
            {' · '}5 секунд тутамд шинэчлэгдэнэ
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            Шинэчлэх
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryMut.mutate()}
            disabled={retryMut.isPending || queue.failed === 0}
          >
            <Zap className="mr-2 h-4 w-4" />
            Алдаатай job дахин эхлүүлэх ({queue.failed})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cleanMut.mutate()}
            disabled={cleanMut.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Цэвэрлэх
          </Button>
        </div>
      </div>

      {/* Bull Queue Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bull Queue — Redis</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Хүлээж байгаа" value={queue.waiting} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" icon={Clock} />
          <StatCard label="Боловсруулж байгаа" value={queue.active} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" icon={Activity} />
          <StatCard label="Амжилттай" value={queue.completed} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" icon={CheckCircle2} />
          <StatCard label="Алдаатай" value={queue.failed} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" icon={AlertCircle} />
        </div>
      </div>

      {/* DB ZipJob Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">ZipJob — Мэдээллийн сан</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="PENDING" value={db.pending} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" icon={Clock} />
          <StatCard label="PROCESSING" value={db.processing} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" icon={Activity} />
          <StatCard label="DONE" value={db.done} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" icon={CheckCircle2} />
          <StatCard label="FAILED" value={db.failed} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" icon={AlertCircle} />
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Сүүлийн алдаатай job-ууд
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentFailed.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Алдаатай job байхгүй</p>
            ) : (
              recentFailed.map((job) => <JobRow key={job.id} job={job} type="failed" />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Сүүлийн амжилттай job-ууд
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentCompleted.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Амжилттай job байхгүй</p>
            ) : (
              recentCompleted.map((job) => <JobRow key={job.id} job={job} type="completed" />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
