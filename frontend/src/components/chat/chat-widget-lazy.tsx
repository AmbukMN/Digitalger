'use client';

import dynamic from 'next/dynamic';

// Chat widget framer-motion агуулдаг бөгөөд анхны ачаалалд шаардлагагүй.
// ssr:false нь зөвхөн Client Component дотор зөвшөөрөгддөг тул энэ wrapper-д
// dynamic import хийж анхны JS bundle-аас гаргана — хэрэглэгч контентоо
// ачаалсны дараа background-д ачаалагдана.
const ChatWidget = dynamic(
  () => import('@/components/chat/chat-widget').then((m) => m.ChatWidget),
  { ssr: false },
);

export function ChatWidgetLazy() {
  return <ChatWidget />;
}
