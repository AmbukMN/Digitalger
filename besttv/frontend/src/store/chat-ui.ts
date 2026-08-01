'use client';

import { create } from 'zustand';

/**
 * Чатыг ГАДНААС нээх/хаах store.
 *
 * ⚠️ Counter-signal хэв маяг: boolean БИШ өсдөг тоо. `true` дээр `true` дахин
 * тавихад re-render trigger болохгүй тул давтан дуудлага алдагдана. Counter нь
 * дуудлага бүрийг ялгах ба хүлээн авагч тал `lastSignalRef`-ээр нэг л удаа
 * боловсруулна.
 */
interface ChatUiState {
  openSignal: number;
  closeSignal: number;
  chatOpen: boolean;
  requestOpenChat: () => void;
  requestCloseChat: () => void;
  setChatOpen: (v: boolean) => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  openSignal: 0,
  closeSignal: 0,
  chatOpen: false,
  requestOpenChat: () => set((s) => ({ openSignal: s.openSignal + 1 })),
  requestCloseChat: () => set((s) => ({ closeSignal: s.closeSignal + 1 })),
  setChatOpen: (v) => set({ chatOpen: v }),
}));
