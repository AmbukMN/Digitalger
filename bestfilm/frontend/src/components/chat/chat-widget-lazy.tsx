'use client';

import dynamic from 'next/dynamic';

// Чат widget нь framer-motion агуулдаг бөгөөд анхны ачаалалд шаардлагагүй.
// `ssr: false` нь зөвхөн Client Component дотор зөвшөөрөгддөг тул энэ wrapper
// хэрэгтэй (layout.tsx нь Server Component). Хуудас hydrate болсны дараа
// background-д ачаалагдана — анхны JS bundle хөнгөн үлдэнэ.
const ChatWidget = dynamic(
  () => import('@/components/chat/chat-widget').then((m) => m.ChatWidget),
  { ssr: false },
);

export function ChatWidgetLazy() {
  return <ChatWidget />;
}
