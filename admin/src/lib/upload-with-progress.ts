'use client';

import { toast } from 'sonner';
import { adminApi } from './api';

const PROGRESS_TOAST_THRESHOLD = 5 * 1024 * 1024; // 5MB-с дээш файлд progress харуулна

export async function uploadWithProgress(file: File): Promise<Awaited<ReturnType<typeof adminApi.upload>>> {
  const showProgress = file.size >= PROGRESS_TOAST_THRESHOLD;

  if (!showProgress) {
    return adminApi.upload(file);
  }

  const toastId = `upload-${Date.now()}-${Math.random()}`;
  const mb = (file.size / (1024 * 1024)).toFixed(1);

  toast.loading(`Байршуулж байна... (0%) — ${file.name} (${mb} MB)`, { id: toastId, duration: Infinity });

  try {
    const result = await adminApi.upload(file, (percent) => {
      if (percent < 100) {
        toast.loading(`Байршуулж байна... (${percent}%) — ${file.name} (${mb} MB)`, { id: toastId, duration: Infinity });
      }
    });
    toast.success(`Байршуулагдлаа — ${file.name}`, { id: toastId, duration: 2500 });
    return result;
  } catch (err) {
    toast.error(`Байршуулахад алдаа — ${file.name}`, { id: toastId, duration: 3000 });
    throw err;
  }
}
