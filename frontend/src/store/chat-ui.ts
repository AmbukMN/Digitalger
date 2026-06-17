'use client';

import { create } from 'zustand';

// Chat widget + Help Assistant-ийн ХАРИЛЦАН ТӨЛӨВ store (persist хэрэггүй).
// Зорилго: хоёр нь ЗЭРЭГ нээгдэхгүй — нэгийг нээхэд нөгөө нь автоматаар хаагдана.
//   - openSignal: Help "AI Туслах" таб → chat widget нээх сигнал (counter)
//   - closeChatSignal: Help нээгдэх үед chat-ийг хаах сигнал
//   - closeHelpSignal: Chat нээгдэх үед help-ийг хаах сигнал
interface ChatUiState {
  openSignal: number;
  closeChatSignal: number;
  closeHelpSignal: number;
  // Help → chat нээ (help-ийг хаахыг chat өөрөө onOpen дээр requestCloseHelp дуудна)
  requestOpenChat: () => void;
  // Chat нээгдлээ → help хаа
  requestCloseHelp: () => void;
  // Help нээгдлээ → chat хаа
  requestCloseChat: () => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  openSignal: 0,
  closeChatSignal: 0,
  closeHelpSignal: 0,
  requestOpenChat: () => set((s) => ({ openSignal: s.openSignal + 1 })),
  requestCloseHelp: () => set((s) => ({ closeHelpSignal: s.closeHelpSignal + 1 })),
  requestCloseChat: () => set((s) => ({ closeChatSignal: s.closeChatSignal + 1 })),
}));
