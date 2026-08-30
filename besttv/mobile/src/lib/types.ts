/**
 * BestTV API-ийн төрлүүд.
 *
 * ⚠️ Backend-ийн БОДИТ хариунаас гаргасан (production-оос шалгасан,
 * 2026-08-30) — таамаглаагүй.
 */

export interface TitleCard {
  id: string;
  type: 'MOVIE' | 'SERIES';
  title: string;
  slug: string;
  /** ⚠️ CDN-ийн БҮТЭН URL (assets.besttv.us) — `posterKey` нь түүхий key */
  posterUrl: string | null;
  backdropUrl: string | null;
  isPremium: boolean;
  rating: number | null;
  year: number | null;
  views: number;
  comingSoon: boolean;
  createdAt: string;
  language?: 'MN' | 'SUB';
  episodeCount?: number;
  genres?: { id: string; name: string }[];
}

export interface GenreRow {
  id: string;
  name: string;
  slug: string;
  items: TitleCard[];
}

export interface ContinueItem extends TitleCard {
  positionSec: number;
  durationSec: number;
  episodeId?: string | null;
  episodeNumber?: number | null;
}

export interface HomeData {
  banners: TitleCard[];
  newReleases: TitleCard[];
  comingSoon: TitleCard[];
  popular: TitleCard[];
  genreRows: GenreRow[];
  /** ⚠️ Зөвхөн нэвтэрсэн үед ирнэ */
  continueWatching?: ContinueItem[];
}

export interface Episode {
  id: string;
  number: number;
  name: string | null;
  description: string | null;
  durationSec: number | null;
  isFreePreview: boolean;
  streamStatus: string;
  posterUrl?: string | null;
  introStartSec?: number | null;
  introEndSec?: number | null;
  outroStartSec?: number | null;
}

export interface Season {
  id: string;
  number: number;
  name: string | null;
  episodes: Episode[];
}

/** ⚠️ Зөвхөн НЭВТЭРСЭН үед ирнэ — үргэлжлүүлэн үзэх байрлал */
export interface WatchProgress {
  positionSec: number;
  durationSec: number | null;
  /** ⚠️ Цувралд аль анги дээр зогссоныг заана (кинонд `null`) */
  episodeId: string | null;
}

export interface TitleDetail extends TitleCard {
  description: string | null;
  country: string | null;
  director: string | null;
  ageRating: string | null;
  actors: string[];
  cast: { name: string; character?: string; photoUrl?: string }[];
  durationSec: number | null;
  seasons: Season[];
  /** ⚠️ Хэрэглэгч энэ контентыг үзэх эрхтэй эсэх (нэвтэрсэн үед) */
  hasAccess?: boolean;
  trailerAvailable?: boolean;
  /** ⚠️ Үргэлжлүүлэн үзэх байрлал — зөвхөн нэвтэрсэн үед ирнэ */
  progress?: WatchProgress | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  walletBalance: number;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  subscriptions: {
    id?: string;
    planId: string;
    planName: string;
    isVip: boolean;
    expiresAt: string;
    autoRenew?: boolean;
    supersededByVip?: boolean;
    genres: { id: string; name: string }[];
  }[];
}
