import { Facebook, Instagram } from 'lucide-react';

export type Channel = 'FACEBOOK' | 'INSTAGRAM';

export interface SocialTarget {
  id: string;
  channel: Channel;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'SKIPPED';
  caption: string | null;
  externalId: string | null;
  error: string | null;
  attempts: number;
  publishedAt: string | null;
  /** ⚠️ FB өөрөө товлосон — Meta автоматаар нийтэлнэ */
  fbNativeScheduled: boolean;
}

export interface SocialPost {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  body: string;
  mediaKeys: string[];
  mediaUrls?: (string | null)[];
  /** ⚠️ Видеоны thumbnail — жагсаалт/preview-д ХАРАГДАХЫН тулд */
  posterUrls?: (string | null)[];
  scheduledAt: string | null;
  /** ⚠️ NEXT_AVAILABLE постууд хуваарь солиход ШИЛЖИНЭ */
  scheduleKind: 'NEXT_AVAILABLE' | 'CUSTOM';
  titleId: string | null;
  title?: { id: string; title: string; slug: string } | null;
  recycle?: {
    gap?: number;
    freq?: string;
    expireCount?: number;
    done?: number;
    /** ⚠️ Тогтмол гараг+цаг — «Мягмар бүр 07:00» (УБ) */
    weekday?: number;
    time?: string;
  } | null;
  targets: SocialTarget[];
  createdAt: string;
}

export interface ChannelInfo {
  paused: Record<string, boolean>;
  igQuota: { used: number; cap: number } | null;
}

export interface ValidationIssue {
  channel: Channel;
  level: 'block' | 'warn';
  message: string;
}

export interface Slot {
  id: string;
  channel: Channel;
  weekday: number;
  time: string;
}

/** ⚠️ Сувгийн нэр/өнгийг НЭГ эх сурвалжаас — зөрөхөөс сэргийлнэ */
export const CHANNEL_META: Record<Channel, { label: string; cls: string; Icon: typeof Facebook }> =
  {
    FACEBOOK: {
      label: 'Facebook',
      cls: 'bg-[#1877F2]/15 text-[#1877F2]',
      Icon: Facebook,
    },
    INSTAGRAM: {
      label: 'Instagram',
      cls: 'bg-[#E1306C]/15 text-[#E1306C]',
      Icon: Instagram,
    },
  };

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Ноорог', cls: 'bg-muted text-muted-foreground' },
  SCHEDULED: { label: 'Товлосон', cls: 'bg-primary/15 text-primary' },
  PUBLISHING: { label: 'Илгээж байна', cls: 'bg-warning/15 text-warning' },
  PUBLISHED: { label: 'Нийтэлсэн', cls: 'bg-success/15 text-success' },
  /* ⚠️ ХЭСЭГЧИЛСЭН — нэг суваг болсон, нөгөө нь болоогүй */
  PARTIAL: { label: 'Хэсэгчилсэн', cls: 'bg-warning/20 text-warning' },
  FAILED: { label: 'Амжилтгүй', cls: 'bg-destructive/15 text-destructive' },
  CANCELLED: { label: 'Цуцалсан', cls: 'bg-muted text-muted-foreground' },
};

/** Meta-гийн хатуу хязгаарууд (албан ёсны баримт) */
export const IG_CAPTION_MAX = 2200;
export const IG_FOLD = 125;
export const FB_FOLD = 477;
export const WEEKDAYS = ['Ням', 'Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям'];
