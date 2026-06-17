'use client';

import { create } from 'zustand';

// Chat widget + Help Assistant + Help Bubble-ийн ХАРИЛЦАН ТӨЛӨВ store (persist хэрэггүй).
// Зорилго: хоёр panel ЗЭРЭГ нээгдэхгүй; proactive bubble panel нээлттэй үед гарахгүй.
//   - openSignal: Help "AI Туслах" таб → chat widget нээх сигнал (counter)
//   - openHelpSignal: Help bubble → help panel нээх сигнал (counter)
//   - closeChatSignal / closeHelpSignal: харилцан хаах сигнал
//   - chatOpen / helpOpen: одоо аль нэг нь нээлттэй эсэх (bubble давхцахаас сэргийлнэ)
interface ChatUiState {
  openSignal: number;
  openHelpSignal: number;
  closeChatSignal: number;
  closeHelpSignal: number;
  chatOpen: boolean;
  helpOpen: boolean;
  requestOpenChat: () => void;
  requestOpenHelp: () => void;
  requestCloseHelp: () => void;
  requestCloseChat: () => void;
  setChatOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  openSignal: 0,
  openHelpSignal: 0,
  closeChatSignal: 0,
  closeHelpSignal: 0,
  chatOpen: false,
  helpOpen: false,
  requestOpenChat: () => set((s) => ({ openSignal: s.openSignal + 1 })),
  requestOpenHelp: () => set((s) => ({ openHelpSignal: s.openHelpSignal + 1 })),
  requestCloseHelp: () => set((s) => ({ closeHelpSignal: s.closeHelpSignal + 1 })),
  requestCloseChat: () => set((s) => ({ closeChatSignal: s.closeChatSignal + 1 })),
  setChatOpen: (v) => set({ chatOpen: v }),
  setHelpOpen: (v) => set({ helpOpen: v }),
}));
