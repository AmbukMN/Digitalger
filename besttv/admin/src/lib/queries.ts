import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Утгатай (хоосон биш) параметрүүдийг л query болгоно */
function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v == null || v === '' || v === 'ALL') continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

export interface AdminTitle {
  id: string;
  type: 'MOVIE' | 'SERIES';
  title: string;
  slug: string;
  posterUrl: string | null;
  isPremium: boolean;
  /**
   * ⚠️ SERIES-д энэ нь backend дээр АНГИУДААС тооцогдоно
   * (`Title.streamStatus` нь цувралд хэзээ ч өөрчлөгддөггүй).
   */
  streamStatus: string;
  /** Цувралын ангийн явц — «7/10 анги» гэж харуулна (зөвхөн SERIES) */
  episodeStats?: { total: number; ready: number };
  /** HLS хөрвүүлэлтийн явц 0-100 (PROCESSING үед) */
  streamProgress?: number;
  streamError?: string | null;
  isActive: boolean;
  isBanner: boolean;
  comingSoon: boolean;
  year: number | null;
  views: number;
  /** Хэлний хувилбар — жагсаалтын "Хэл" баганад харагдана */
  language?: 'MN' | 'SUB';
  /**
   * ⚠️ Backend-ийн `decorate()` нь Prisma-гийн `[{genre:{...}}]`-ийг
   * `[{...}]` болгож ХАВТГАЙРУУЛДАГ. Хуучин хэлбэр ирэх магадлалыг ч
   * тооцоод хоёуланг зөвшөөрнө (genreName() helper-ээр уншина).
   */
  genres: ({ id?: string; name?: string } | { genre: { id?: string; name: string } })[];
  _count: { seasons: number };
}

/** Контентын жагсаалтын бүрэн шүүлт */
export interface TitleFilters {
  q?: string;
  type?: string;
  genre?: string;
  /** streamStatus: NONE | UPLOADED | PROCESSING | READY | FAILED */
  status?: string;
  /** 'premium' | 'free' */
  access?: string;
  /** 'true' | 'false' */
  active?: string;
  year?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function useAdminTitles(params: TitleFilters) {
  return useQuery({
    queryKey: ['admin-titles', params],
    queryFn: () =>
      api<{ items: AdminTitle[]; total: number; page: number; totalPages: number }>(
        `/admin/titles?${toQuery(params)}`,
      ),
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Контентын тоолол — табын badge */
export function useAdminTitleCounts(params: { q?: string; genre?: string; year?: string }) {
  return useQuery({
    queryKey: ['admin-title-counts', params],
    queryFn: () => api<Record<string, number>>(`/admin/titles/counts?${toQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}


/**
 * Админы кино дэлгэрэнгүй — улирал/ангитай.
 *
 * ⚠️ Өмнө нь `any` байсан тул `season.episodes` бичихэд алдаа
 * баригдахгүй, талбарын нэр солигдоход ЧИМЭЭГҮЙ эвдэрдэг байв.
 */
export interface AdminEpisode {
  id: string;
  number: number;
  name: string | null;
  streamStatus: 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';
  streamProgress: number;
  streamError?: string | null;
  durationSec: number | null;
  posterUrl?: string | null;
  isFreePreview: boolean;
}

export interface AdminSeason {
  id: string;
  number: number;
  name: string | null;
  episodes: AdminEpisode[];
}

export interface AdminTitleDetail {
  id: string;
  title: string;
  slug: string;
  type: 'MOVIE' | 'SERIES';
  streamStatus: 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';
  streamProgress: number;
  seasons?: AdminSeason[];
  [key: string]: unknown;
}

export function useAdminTitle(id: string) {
  return useQuery({
    queryKey: ['admin-title', id],
    queryFn: () => api<AdminTitleDetail>(`/admin/titles/${id}`),
    enabled: !!id && id !== 'new',
    // HLS хөрвүүлэлт (кино эсвэл аль нэг анги) явж байхад автоматаар polling
    // хийж, READY болмогц хуудас сэргээлтгүйгээр шинэчлэгдэнэ.
    refetchInterval: (query) => {
      const data = query.state.data as AdminTitleDetail | undefined;
      const hasProcessing =
        data?.streamStatus === 'PROCESSING' ||
        data?.seasons?.some((s) => s.episodes?.some((e) => e.streamStatus === 'PROCESSING'));
      return hasProcessing ? 5000 : false;
    },
  });
}

export interface AdminGenre {
  id: string;
  name: string;
  slug: string;
  order: number;
  isAdult: boolean;
  _count?: { titles: number };
}

export function useAdminGenres() {
  return useQuery({
    queryKey: ['admin-genres'],
    queryFn: () => api<AdminGenre[]>('/admin/genres'),
  });
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  features: string[];
  isActive: boolean;
  isVip: boolean;
  order: number;
  genres: { id: string; name: string; slug: string; isAdult: boolean }[];
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api<AdminPlan[]>('/admin/plans'),
  });
}

export interface AdminPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageKey: string | null;
  ogImageUrl?: string | null;
  isActive: boolean;
  order: number;
  updatedAt: string;
}

/** Нүүрний ДУНД баннер — hero carousel-ЭЭС ТУСДАА */
export interface AdminBanner {
  id: string;
  title: string;
  subtitle: string;
  imageKey: string;
  mobileImageKey: string | null;
  ctaText: string;
  ctaHref: string;
  /** Хэддэх жанрын эгнээний ДАРАА орох (0 = хамгийн дээр) */
  position: number;
  order: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
}

export function useAdminBanners() {
  return useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api<AdminBanner[]>('/admin/banners'),
  });
}

export function useAdminPages() {
  return useQuery({
    queryKey: ['admin-pages'],
    queryFn: () => api<AdminPage[]>('/admin/pages'),
  });
}

export function useAdminPage(id: string) {
  return useQuery({
    queryKey: ['admin-page', id],
    queryFn: () => api<AdminPage>(`/admin/pages/${id}`),
    enabled: !!id && id !== 'new',
  });
}

export interface DashboardStats {
  range: string;
  days: number;
  totalUsers: number;
  newUsers: number;
  /** Өмнөх ижил урттай мужтай харьцуулсан % (null = харьцуулах өгөгдөлгүй) */
  newUsersGrowth: number | null;
  activeSubscriptions: number;
  newSubscriptions: number;
  newSubscriptionsGrowth: number | null;
  totalTitles: number;
  totalMovies: number;
  totalSeries: number;
  totalRevenue: number;
  revenue: number;
  revenueGrowth: number | null;
  paidCount: number;
  /** Дундаж чек */
  avgOrder: number;
  rentals: number;
  recentPayments: {
    id: string;
    amount: number;
    paidAt: string | null;
    isWalletTopup?: boolean;
    user: { email: string; name: string | null };
    plan: { name: string } | null;
  }[];
  topTitles: { id: string; title: string; type: string; views: number; rating: number | null }[];
  /** Өдөр/долоо хоногийн цуваа — график */
  series: { date: string; revenue: number; users: number }[];
  planBreakdown: {
    id: string;
    name: string;
    price: number;
    isVip: boolean;
    activeCount: number;
  }[];
  // backward-compat
  newUsersMonth: number;
  revenueLast30Days: number;
}

/** @param range today | 7d | 30d | 90d | 365d */
export function useDashboard(range = '30d') {
  return useQuery({
    queryKey: ['admin-dashboard', range],
    queryFn: () => api<DashboardStats>(`/admin/analytics/dashboard?range=${range}`),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  /** LOCAL | GOOGLE | FACEBOOK | GUEST */
  provider: string;
  emailVerified: boolean;
  createdAt: string;
  walletBalance: number;
  activeSubscription: { planName: string; expiresAt: string } | null;
}

/** Хэрэглэгчийн жагсаалтын бүрэн шүүлт */
export interface UserFilters {
  q?: string;
  role?: string;
  /** 'active' | 'blocked' */
  status?: string;
  /** 'active' = багцтай, 'none' = багцгүй */
  sub?: string;
  provider?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function useAdminUsers(params: UserFilters) {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: () =>
      api<{
        items: AdminUser[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/users?${toQuery(params)}`),
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Хэрэглэгчийн тоолол — табын badge */
export function useAdminUserCounts(params: { q?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['admin-user-counts', params],
    queryFn: () => api<Record<string, number>>(`/admin/users/counts?${toQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}

export interface AdminWalletTx {
  id: string;
  type: 'TOPUP' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'PURCHASE' | 'REFUND';
  amount: number;
  balanceAfter: number;
  description: string;
  planName: string | null;
  createdAt: string;
}

export function useAdminWalletTxs(userId: string) {
  return useQuery({
    queryKey: ['admin-wallet-txs', userId],
    queryFn: () => api<AdminWalletTx[]>(`/admin/wallet/${userId}/transactions`),
    enabled: !!userId,
  });
}

// ─── Хэрэглэгчийн зан төлөвийн insight (tracking) ────────────────────────────

export interface UserInsight {
  summary: {
    totalWatchSec: number;
    titlesStarted: number;
    titlesCompleted: number;
    pageViewCount: number;
    titleEventCount: number;
    searchCount: number;
    lastActive: string | null;
  };
  watching: {
    titleId: string;
    title: string;
    slug: string;
    posterKey: string | null;
    type: 'MOVIE' | 'SERIES';
    episode: { number: number; name: string | null } | null;
    positionSec: number;
    durationSec: number;
    percent: number;
    updatedAt: string;
  }[];
  titleEvents: {
    id: string;
    type: string;
    titleId: string;
    titleName: string | null;
    titleSlug: string | null;
    positionSec: number | null;
    durationSec: number | null;
    device: string | null;
    createdAt: string;
  }[];
  topPages: { path: string; count: number }[];
  recentPages: { path: string; device: string | null; referrer: string | null; createdAt: string }[];
  searches: { query: string; results: number; createdAt: string }[];
  auditLogs: {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    actor: string;
    createdAt: string;
  }[];
}

/** Хэрэглэгчийн бүрэн зан төлөв — зөвхөн dialog нээгдсэн үед дуудна */
export function useUserInsight(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-user-insight', userId],
    queryFn: () => api<UserInsight>(`/admin/tracking/user/${userId}`),
    enabled: !!userId && enabled,
    staleTime: 0,
  });
}

export interface AdminUserDetail extends AdminUser {
  provider: string;
  emailVerified: boolean;
  isGuest: boolean;
  walletBalance: number;
  payments: { id: string; amount: number; status: string; createdAt: string; plan: { name: string } | null; isWalletTopup?: boolean }[];
  subscriptions: {
    id: string;
    startsAt: string;
    expiresAt: string;
    /** null = админ гараар олгосон (төлбөргүй) */
    paymentId: string | null;
    plan: {
      id: string;
      name: string;
      isVip: boolean;
      genres: { genre: { id: string; name: string } }[];
    };
  }[];
  myList: { createdAt: string; title: { id: string; title: string; slug: string; posterKey: string | null } }[];
  watchProgress: {
    positionSec: number;
    durationSec: number;
    updatedAt: string;
    title: { id: string; title: string; slug: string };
  }[];
  /** ⚠️ Ширхэгээр түрээслэсэн — БАГЦААС тусдаа эрх */
  rentals: {
    id: string;
    createdAt: string;
    expiresAt: string;
    amount: number;
    title: { id: string; title: string; slug: string };
  }[];
  /** Бичсэн сэтгэгдэл — зохисгүй агуулга шалгах */
  reviews: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    title: { title: string; slug: string };
  }[];
  /** Хэтэвчний гүйлгээ — мөнгө хаашаа явсныг мөрдөх */
  walletTxs: {
    id: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }[];
  /** ⚠️ Мэдэгдэл — хэрэглэгчид ЮУ харагдсаныг админ мэдэх ёстой */
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
  }[];
  /** ⚠️ Нэвтэрсэн төхөөрөмж — «яагаад гарчихав» гомдолд хариулна */
  sessions: {
    id: string;
    deviceName: string | null;
    ip: string | null;
    lastUsedAt: string;
    createdAt: string;
  }[];
  /** Ашигласан урамшуулал */
  promotionRedemptions: {
    id: string;
    valueGiven: number;
    daysGiven: number;
    createdAt: string;
    promotion: { name: string; type: string } | null;
  }[];
  /**
   * ⚠️⚠️ АУДИТ ЛОГ — нэвтрэлт, нууц үг солих, эрх өөрчлөх, админы
   * гар үйлдэл. DB-д бүртгэгддэг атлаа админд ОГТ харагддаггүй байв.
   */
  auditLog: {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    actor: string;
    ip: string | null;
    createdAt: string;
  }[];
  /** Дансаар төлсөн түүх (гараар баталгаажуулсан) */
  bankPayments: {
    id: string;
    amount: number;
    status: string;
    bankReference: string | null;
    bankClaimedAt: string | null;
    bankReviewedAt: string | null;
    bankRejectReason: string | null;
    createdAt: string;
  }[];
  /** Хайсан үгс — юуг хайж олоогүйг мэдвэл контент нэмнэ */
  recentSearches: { query: string; results: number; createdAt: string }[];
  /** Идэвхийн хураангуй */
  activity: {
    viewCount: number;
    searchCount: number;
    playCount: number;
    /** ₮ — нийт зарцуулсан (цэнэглэлт хасна) */
    totalSpent: number;
    lastSeen: { createdAt: string; path: string; device: string | null } | null;
  };
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => api<AdminUserDetail>(`/admin/users/${id}`),
    enabled: !!id,
  });
}

export interface AdminPayment {
  id: string;
  amount: number;
  status: string;
  /** true = хэтэвч цэнэглэлт (багц худалдан авалт биш) */
  isWalletTopup: boolean;
  couponCode: string | null;
  /** Купон хэрэглэхээс өмнөх дүн (хямдрал харуулахад) */
  originalAmount: number | null;
  qpayInvoiceId: string | null;
  paidAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  plan: { id: string; name: string } | null;
}

export interface SeoSettings {
  siteName: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  twitterCard: string;
  noindex: boolean;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  siteVerification: string;
}

export function useAdminSeo() {
  return useQuery({
    queryKey: ['admin-seo'],
    queryFn: () => api<SeoSettings>('/admin/seo'),
  });
}

/** Төлбөрийн жагсаалтын бүрэн шүүлт */
export interface PaymentFilters {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  minAmount?: string;
  maxAmount?: string;
  /** 'plan' | 'topup' — багц худалдан авалт эсвэл хэтэвч цэнэглэлт */
  kind?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AdminPaymentsResult {
  items: AdminPayment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: { totalAmount: number; paidAmount: number; paidCount: number };
}



export function useAdminPayments(params: PaymentFilters) {
  return useQuery({
    queryKey: ['admin-payments', params],
    queryFn: () => api<AdminPaymentsResult>(`/admin/payments?${toQuery(params)}`),
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Төлөв бүрийн тоо — табын badge (бусад шүүлтийг хүндэтгэнэ) */
export function useAdminPaymentCounts(params: {
  search?: string;
  from?: string;
  to?: string;
  kind?: string;
}) {
  return useQuery({
    queryKey: ['admin-payment-counts', params],
    queryFn: () => api<Record<string, number>>(`/admin/payments/counts?${toQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  hasSpoiler: boolean;
  isStaff: boolean;
  isHidden: boolean;
  reportCount: number;
  parentId: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  title: { id: string; title: string; slug: string };
  reports: { reason: string; note: string; createdAt: string }[];
  _count: { replies: number; votes: number };
}

export function useAdminReviews(params: {
  q?: string;
  rating?: number;
  page?: number;
  onlyReported?: boolean;
  onlyHidden?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.rating) qs.set('rating', String(params.rating));
  if (params.page) qs.set('page', String(params.page));
  if (params.onlyReported) qs.set('onlyReported', '1');
  if (params.onlyHidden) qs.set('onlyHidden', '1');

  return useQuery({
    queryKey: ['admin-reviews', params],
    queryFn: () =>
      api<{
        items: AdminReview[];
        total: number;
        reportedTotal: number;
        page: number;
        totalPages: number;
      }>(`/admin/reviews?${qs.toString()}`),
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
}

export function useAdminFaqs() {
  return useQuery({
    queryKey: ['admin-faqs'],
    queryFn: () => api<AdminFaq[]>('/admin/faqs'),
  });
}

export interface AdminCoupon {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  amount: number;
  maxUses: number | null;
  usedCount: number;
  minPrice: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function useAdminCoupons() {
  return useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => api<AdminCoupon[]>('/admin/coupons'),
  });
}

export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverKey: string | null;
  coverUrl: string | null;
  tags: string[];
  author: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  views: number;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
}

export function useAdminBlogPosts(params: { q?: string; page?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  /* ⚠️ 'published' | 'draft' — ноорогоо олоход хэрэгтэй */
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);

  return useQuery({
    queryKey: ['admin-blog', params],
    queryFn: () =>
      api<{ items: AdminBlogPost[]; total: number; page: number; totalPages: number }>(
        `/admin/blog?${qs.toString()}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useAdminBlogPost(id: string) {
  return useQuery({
    queryKey: ['admin-blog-post', id],
    queryFn: () => api<AdminBlogPost>(`/admin/blog/${id}`),
    enabled: !!id && id !== 'new',
  });
}

// ─── Брэнд (лого) ─────────────────────────────────────────────────────────────

export interface BrandSettings {
  logoKey: string | null;
  faviconKey: string | null;
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

/** Админ панелийн лого — нэвтрээгүй үед ч (login хуудас) ажиллана */
export function useBrand() {
  return useQuery({
    queryKey: ['brand'],
    queryFn: () => api<BrandSettings>('/settings/brand', { auth: false }),
    staleTime: 10 * 60_000,
  });
}

/** Админ — засварлахад key-тэй хамт */
export function useAdminBrand() {
  return useQuery({
    queryKey: ['admin-brand'],
    queryFn: () => api<BrandSettings>('/admin/settings/brand'),
    staleTime: 0,
  });
}

// ─── УРАМШУУЛАЛ ──────────────────────────────────────────────────────────────

export type PromotionType = 'EXTRA_DAYS' | 'DISCOUNT' | 'GIFT_PLAN' | 'WALLET_BONUS';

export interface AdminPromotion {
  id: string;
  name: string;
  shortText: string;
  description: string;
  type: PromotionType;
  bonusDays: number | null;
  discountType: 'PERCENT' | 'FIXED' | null;
  discountValue: number | null;
  giftPlanId: string | null;
  giftPlan: { id: string; name: string } | null;
  giftDays: number | null;
  minTopup: number | null;
  bonusAmount: number | null;
  plans: { planId: string }[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  maxPerUser: number;
  newUsersOnly: boolean;
  blockCoupons: boolean;
  bannerKey: string | null;
  bannerMobileKey: string | null;
  /* ⚠️ Preview харуулахад — зөвхөн key байвал админ юу оруулснаа мэдэхгүй */
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
  order: number;
  createdAt: string;
  _count: { redemptions: number };
}

export function useAdminPromotions() {
  return useQuery({
    queryKey: ['admin-promotions'],
    queryFn: () => api<AdminPromotion[]>('/admin/promotions'),
    /* ⚠️ Урамшуулал нь хугацаанаас хамаардаг тул шинэ мэдээлэл чухал */
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

// ─── ДАНСААР ТӨЛӨХ ───────────────────────────────────────────────────────────

export interface BankSettings {
  enabled: boolean;
  note: string;
  /** Төлбөрийн баримт (screenshot) заавал эсэх */
  requireReceipt: boolean;
}

export interface AdminBankAccount {
  id: string;
  bankName: string;
  logoKey: string | null;
  logoUrl: string | null;
  accountNumber: string;
  iban: string | null;
  accountName: string;
  isActive: boolean;
  order: number;
  _count: { payments: number };
}

export function useAdminBankAccounts() {
  return useQuery({
    queryKey: ['admin-bank-accounts'],
    queryFn: () => api<AdminBankAccount[]>('/admin/bank/accounts'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export interface AdminBankPayment {
  id: string;
  amount: number;
  originalAmount: number | null;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  bankReference: string | null;
  bankClaimedAt: string | null;
  bankReviewedAt: string | null;
  bankRejectReason: string | null;
  /** ⚠️ Төлбөрийн баримт — админ зургийг ШУУД харна (татахгүй) */
  bankReceiptKey: string | null;
  receiptUrl: string | null;
  couponCode: string | null;
  createdAt: string;
  isWalletTopup: boolean;
  plan: { id: string; name: string } | null;
  user: { id: string; name: string | null; email: string } | null;
  bankAccount: { id: string; bankName: string } | null;
}

export function useAdminBankSettings() {
  return useQuery({
    queryKey: ['admin-bank-settings'],
    queryFn: () => api<BankSettings>('/admin/bank/settings'),
  });
}

/**
 * ⚠️ `staleTime: 0` + focus refetch — хэрэглэгч мөнгө шилжүүлээд
 * хүлээж байна. Хуучирсан жагсаалт харуулах нь хүлээлт уртасгана.
 */
export function useAdminBankPayments(status?: string) {
  return useQuery({
    queryKey: ['admin-bank-payments', status ?? 'all'],
    queryFn: () =>
      api<AdminBankPayment[]>(`/admin/bank/payments${status ? `?status=${status}` : ''}`),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
