'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { VideoPlayer } from '@/components/video-player';

export function TrailerModal({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Трейлер"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Хаах"
        className="absolute right-4 top-4 rounded-full bg-foreground/10 p-2 text-foreground hover:bg-foreground/20"
      >
        <X size={22} />
      </button>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <VideoPlayer src={`/api/stream/trailer/${titleId}/playlist.m3u8`} />
      </div>
    </div>
  );
}
