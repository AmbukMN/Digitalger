export type UserRole = 'ADMIN' | 'USER';
export type TitleType = 'MOVIE' | 'SERIES';
export type StreamStatus = 'NONE' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

/** Card жагсаалтын хөнгөн title (backend CARD_SELECT-тэй ижил) */
export interface TitleCard {
  id: string;
  type: TitleType;
  title: string;
  slug: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  isPremium: boolean;
  rating: number | null;
  year: number | null;
  views: number;
  comingSoon: boolean;
  /**
   * Киноны хэлний хувилбар — картан дээр шошго болно.
   * MN = монгол хэлтэй (🇲🇳 "Хэл") | SUB = хадмал орчуулгатай ("Хадмал")
   */
  language?: 'MN' | 'SUB';
  /** Аль жанрт багтахыг картад харуулна (эхний 2) */
  genres?: { id: string; name: string; slug: string; isAdult?: boolean }[];
  /**
   * Видео тоглуулахад БЭЛЭН эсэх.
   *
   * ⚠️ Хөрвүүлэлт (HLS) хэдэн минутаас хэдэн цаг үргэлжилдэг. Энэ талбар
   * байхгүй үед бэлэн БУС кино каталогт ялгагдалгүй харагдаж, хэрэглэгч
   * дараад "Видео бэлтгэгдэж байна" гэсэн бичигтэй тулгардаг байв —
   * "ажиллахгүй байна" гэж ойлгогддог. Одоо картан дээрээ тэмдэглэнэ.
   */
  streamStatus?: 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';
}

export interface GenreRow {
  id: string;
  name: string;
  slug: string;
  titles: TitleCard[];
}

export interface PlanInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  features: string[];
  /** VIP = бүх жанрын контент нээгдэнэ */
  isVip: boolean;
  /** «Хамгийн ашигтай» тэмдэг — admin удирдана (бүх VIP-д авто биш) */
  isBestValue?: boolean;
  /** Энэ багц нээх жанрууд (VIP бол хоосон) */
  genres: { id: string; name: string; slug: string; isAdult: boolean }[];
}
