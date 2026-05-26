'use client';

import { toast } from 'sonner';
import { adminApi } from './api';
import type { UploadResult } from '@/types/admin';

const PROGRESS_TOAST_THRESHOLD = 5 * 1024 * 1024;   // 5MB-с дээш → progress toast
const PRESIGN_THRESHOLD = 100 * 1024 * 1024;         // 100MB-с дээш → presigned URL

/** Browser→R2 шууд upload (presigned PUT) — ENOBUFS-аас зайлсхийнэ */
async function uploadDirect(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const { uploadUrl, key, publicUrl } = await adminApi.presignUpload({
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    folder,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });

  return {
    key,
    url: publicUrl,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

export async function uploadWithProgress(
  file: File,
  folder = 'uploads',
): Promise<UploadResult> {
  const isLarge = file.size >= PRESIGN_THRESHOLD;
  const showProgress = file.size >= PROGRESS_TOAST_THRESHOLD;
  const mb = (file.size / (1024 * 1024)).toFixed(1);
  const toastId = showProgress ? `upload-${Date.now()}-${Math.random()}` : undefined;

  if (toastId) {
    toast.loading(`Байршуулж байна... (0%) — ${file.name} (${mb} MB)`, { id: toastId, duration: Infinity });
  }

  const onProgress = toastId
    ? (percent: number) => {
        if (percent < 100) {
          toast.loading(`Байршуулж байна... (${percent}%) — ${file.name} (${mb} MB)`, { id: toastId, duration: Infinity });
        }
      }
    : undefined;

  try {
    const result = isLarge
      ? await uploadDirect(file, folder, onProgress)
      : await adminApi.upload(file, onProgress);

    if (toastId) toast.success(`Байршуулагдлаа — ${file.name}`, { id: toastId, duration: 2500 });
    return result;
  } catch (err) {
    if (toastId) toast.error(`Байршуулахад алдаа — ${file.name}`, { id: toastId, duration: 3000 });
    throw err;
  }
}
