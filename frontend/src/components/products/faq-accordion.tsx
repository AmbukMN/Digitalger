'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@digitalger/shared';
import type { FAQ } from '@/types/api';

export function FaqAccordion({ faqs }: { faqs: FAQ[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!faqs.length) return null;

  return (
    <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {faqs.map((faq) => (
        <div key={faq.id}>
          <button
            type="button"
            onClick={() => setOpen(open === faq.id ? null : faq.id)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span>{faq.question}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                open === faq.id && 'rotate-180',
              )}
            />
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-300',
              open === faq.id ? 'max-h-96' : 'max-h-0',
            )}
          >
            <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {faq.answer}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
