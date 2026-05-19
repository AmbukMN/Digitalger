'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { UploadResult } from '@/types/admin';

export default function MediaPage() {
  const [uploads, setUploads] = useState<UploadResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setLoading(true);
    try {
      const results: UploadResult[] = [];
      for (const file of Array.from(files)) {
        results.push(await adminApi.upload(file));
      }
      setUploads((prev) => [...results, ...prev]);
      toast.success(`${results.length} файл ачаалагдлаа`);
    } catch {
      toast.error('Ачаалахад алдаа');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Media</h1>
        <p className="text-muted-foreground">R2 руу файл upload</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Файл upload</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            multiple
            onChange={onUpload}
            disabled={loading}
            className="text-sm"
          />
          {loading && (
            <p className="mt-2 text-sm text-muted-foreground">
              Ачаалж байна...
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold">Сүүлийн upload ({uploads.length})</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Одоогоор хоосон</p>
        ) : (
          <ul className="divide-y rounded-xl border border-border">
            {uploads.map((u) => (
              <li
                key={u.key}
                className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{u.fileName}</span>
                <a
                  href={u.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary hover:underline"
                >
                  {u.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
