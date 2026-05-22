'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link as LinkIcon, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export function BlogShareButton({ slug, title }: { slug: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const url = typeof window !== 'undefined' ? window.location.href : `https://digitalger.mn/blog/${slug}`;

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
    setOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Холбоос хуулагдлаа');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Хуулахад алдаа гарлаа');
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-full border border-border bg-muted p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        aria-label="Хуваалцах"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 min-w-40 rounded-xl border border-border bg-card shadow-lg p-1">
          <button
            type="button"
            onClick={handleFacebook}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <svg className="h-4 w-4 text-blue-600 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
            {copied ? 'Хуулагдлаа!' : 'Холбоос хуулах'}
          </button>
        </div>
      )}
    </div>
  );
}
