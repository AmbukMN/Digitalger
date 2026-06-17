'use client';

import { create } from 'zustand';

// Chat widget-ийг ГАДНААС нээх/хаах сигнал store (persist хэрэггүй — зүгээр UI төлөв).
// Help Assistant самбарын "AI Туслах" таб → chat нээх зорилгоор ашиглана.
// chat-widget.tsx нь openSignal-ийг сонсож, нэмэгдэх бүрд цонхоо нээнэ.
interface ChatUiState {
  // Нэмэгдэх тоолуур — өөрчлөгдөх бүрд chat widget цонхоо нээнэ (subscribe)
  openSignal: number;
  requestOpen: () => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  openSignal: 0,
  requestOpen: () => set((s) => ({ openSignal: s.openSignal + 1 })),
}));
