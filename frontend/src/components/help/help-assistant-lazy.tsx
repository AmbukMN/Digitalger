'use client';

import dynamic from 'next/dynamic';

// Help Assistant + proactive bubble — клиент талд lazy load (анхны paint-ыг хүндрүүлэхгүй).
const HelpAssistant = dynamic(
  () => import('@/components/help/help-assistant').then((m) => m.HelpAssistant),
  { ssr: false },
);
const HelpBubble = dynamic(
  () => import('@/components/help/help-bubble').then((m) => m.HelpBubble),
  { ssr: false },
);

export function HelpAssistantLazy() {
  return (
    <>
      <HelpAssistant />
      <HelpBubble />
    </>
  );
}
