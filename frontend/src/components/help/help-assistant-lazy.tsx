'use client';

import dynamic from 'next/dynamic';

// Help Assistant — клиент талд lazy load (анхны paint-ыг хүндрүүлэхгүй).
const HelpAssistant = dynamic(
  () => import('@/components/help/help-assistant').then((m) => m.HelpAssistant),
  { ssr: false },
);

export function HelpAssistantLazy() {
  return <HelpAssistant />;
}
