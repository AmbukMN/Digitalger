import {
  useQuery,
  useQueryClient,
  useMutation,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-store';
import type { GenreRow, PlanInfo, TitleCard } from '@besttv/shared';

export interface HomeData {
  // ⚠️ `id` ЗААВАЛ — `accessState()` жанрын ID-аар эрх тулгадаг
  banners: (TitleCard & {
    description: string;
    trailerAvailable: boolean;
    genres: { id: string; name: string; slug: string }[];
  })[];
  newReleases: TitleCard[];
  comingSoon: TitleCard[];
  popular: TitleCard[];
  continueWatching: (TitleCard & { progress: { positionSec: number; durationSec: number; episode: unknown } })[];
  genreRows: GenreRow[];
}

export interface CastMember {
  name: string;
  character?: string;
  photoUrl: string | null;
}

export interface Episode {
  id: string;
  number: number;
  name: string | null;
  description: string;
  posterUrl: string | null;
  durationSec: number | null;
  streamStatus: string;
  isFreePreview: boolean;
  playable: boolean;
}

export interface Season {
  id: string;
  number: number;
  name: string | null;
  episodes: Episode[];
}

export interface TitleDetail extends Omit<TitleCard, 'comingSoon'> {
  description: string;
  descriptionEn: string | null;
  director: string | null;
  ageRating: string | null;
  castMembers: CastMember[];
  galleryUrls: (string | null)[];
  trailerAvailable: boolean;
  playable?: boolean;
  genres: { id: string; name: string; slug: string; isAdult?: boolean }[];
  seasons: Season[];
  related: TitleCard[];
  progress: { positionSec: number; durationSec: number; episodeId: string | null } | null;
  inMyList: boolean;
  reviewStats: { average: number | null; count: number };
  comingSoon: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Хэрэглэгч энэ контентыг үзэх эрхтэй эсэх (үнэгүй бол үргэлж true) */
  hasAccess: boolean;
  /** Эрхгүй үед аль багц авбал нээгдэхийг харуулна */
  requiredPlans: { id: string; name: string; price: number; isVip: boolean }[];
  /** Ширхэгээр түрээслэх — багц авахгүйгээр нэг киног хугацаатай үзэх */
  rental: {
    available: boolean;
    price: number;
    hours: number;
    active: { expiresAt: string } | null;
  };
}

export interface Review {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  hasSpoiler: boolean;
  isStaff: boolean;
  parentId: string | null;
  helpful: number;
  notHelpful: number;
  score: number;
  /** Уншиж буй хэрэглэгчийн өгсөн санал: 1 | -1 | 0 */
  myVote: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; avatarKey: string | null };
  replies?: Review[];
}

export type ReviewSort = 'helpful' | 'newest' | 'oldest' | 'highest' | 'lowest';

export interface ReviewStats {
  average: number | null;
  count: number;
  distribution: Record<number, number>;
}

/**
 * Нүүр хуудасны контент.
 * ⚠️ `auth: true` — "Үргэлжлүүлэн үзэх" мөр хэрэглэгч тус бүрд өөр тул
 * `queryKey`-д `userId` ЗААВАЛ (эс бөгөөс өмнөх хэрэглэгчийн жагсаалт
 * үлдэнэ).
 */
export function useHome() {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ['home', userId ?? 'guest'],
    queryFn: () => api<HomeData>('/titles/home', { auth: true }),
    staleTime: 60_000,
    /**
     * ⚠️ Нэвтрэлт тодрох агшинд `queryKey` 'guest' → userId болж ШИНЭ
     * кэш үүсдэг тул нүүр хуудасны БҮХ кино гэнэт алга болоод skeleton
     * гарч, дараа нь дахин ирдэг (FLASH). Өмнөх датаг түр хадгална.
     */
    placeholderData: (prev) => prev,
  });
}

export function useCatalog(params: {
  type?: 'MOVIE' | 'SERIES';
  genre?: string;
  sort?: string;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.genre) qs.set('genre', params.genre);
  if (params.sort) qs.set('sort', params.sort);
  if (params.page) qs.set('page', String(params.page));

  return useQuery({
    queryKey: ['catalog', params],
    queryFn: () =>
      api<{ items: TitleCard[]; total: number; page: number; totalPages: number }>(
        `/titles?${qs.toString()}`,
        { auth: false },
      ),
    placeholderData: (prev) => prev,
  });
}

interface CatalogPage {
  items: TitleCard[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Каталог — ХЯЗГААРГҮЙ ГҮЙЛГЭЛТ (infinite scroll).
 *
 * ⚠️ Хуудаслалтын товч (1 2 3) БИШ: хэрэглэгч доош гүйлгэхэд дараагийн
 * хуудас АВТОМАТААР ачаална. Ингэснээр "жанраар харахад бүх кино" нэг
 * урсгалаар харагдана.
 *
 * ⚠️⚠️ ХЭРЭГЛЭГЧ ХАРААГҮЙ ҮЕД АЧААЛАХГҮЙ — `fetchNextPage` нь зөвхөн
 * жагсаалтын ТӨГСГӨЛ дэлгэцэд ОРЖ ИРЭХЭД (IntersectionObserver) л
 * дуудагдана. Урьдчилж бүх хуудсыг татвал зочин эхний дэлгэцийг ч
 * хараагүй байхад 5 хүсэлт явж, дата/батарей дэмий үрэгдэнэ.
 */
export function useCatalogInfinite(params: { genre?: string; sort?: string }) {
  return useInfiniteQuery({
    queryKey: ['catalog-infinite', params],
    /* Каталог 5 минут — шинэ кино тэр бүр нэмэгддэггүй */
    staleTime: 5 * 60_000,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (params.genre) qs.set('genre', params.genre);
      if (params.sort) qs.set('sort', params.sort);
      qs.set('page', String(pageParam));
      return api<CatalogPage>(`/titles?${qs.toString()}`, { auth: false });
    },
    /** Сүүлийн хуудсанд хүрсэн бол `undefined` — өөр хүсэлт явахгүй */
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });
}

/**
 * Киноны дэлгэрэнгүй.
 *
 * ⚠️⚠️ НЭВТЭРЛЭЛТ ТОГТОХЫГ ХҮЛЭЭНЭ — "БАГЦТАЙ МӨРТЛӨӨ ТҮРЭЭСЛЭХ ГЭЖ
 * ГАРДАГ" АЛДААНЫ ЗАСВАР.
 *
 * Өмнө нь `enabled: !!slug` байсан тул хуудас нээгдэх агшинд, токен
 * localStorage-оос уншигдаж `init()` дуусахаас ӨМНӨ хүсэлт явдаг байв.
 * Тэр хүсэлт ТОКЕНГҮЙ тул backend `hasAccess: false` буцааж, хэрэглэгч
 * багцтай атлаа "Түрээслэх / Багц авах" дэлгэц хардаг.
 *
 * ⚠️ `queryKey`-д `userId` ЗААВАЛ — хэрэглэгч солигдоход (нэвтрэх/гарах)
 * кэш шинэчлэгдэнэ. Эс бөгөөс өмнөх хэрэглэгчийн эрх үлдэнэ.
 */
export function useTitleDetail(slug: string) {
  const userId = useAuth((s) => s.user?.id);
  const authLoading = useAuth((s) => s.loading);
  const q = useQuery({
    queryKey: ['title', slug, userId ?? 'guest'],
    queryFn: () => api<TitleDetail>(`/titles/${slug}`, { auth: true }),
    enabled: !!slug && !authLoading,
    /**
     * ⚠️ Хэрэглэгч солигдоход (нэвтрэх/гарах) `queryKey` өөрчлөгдөж ШИНЭ
     * кэш үүсдэг тул хуудас гэнэт skeleton руу үсэрдэг. Өмнөх датаг
     * түр хадгалснаар тэр FLASH арилна — шинэ хариу ирмэгц чимээгүй
     * солигдоно (эрхийн шийдвэр backend-ээс ирсэн шинэ датаар гарна).
     */
    placeholderData: (prev) => prev,
  });

  /**
   * ⚠️⚠️ "КИНО БАЙХГҮЙ" ГЭЖ ГЭНЭТ ГАРААД ДАРАА НЬ КИНО ГАРЧ ИРДЭГ
   * FLASH-ИЙН ЗАСВАР.
   *
   * TanStack Query нь `enabled: false` үед `isLoading = FALSE`,
   * `data = undefined`, `status = 'pending'` буцаадаг. Тиймээс auth
   * ачаалагдаж дуустал (authLoading = true) хуудас нь `isLoading` худал
   * гэж үзээд `!data` нөхцөлөөр "Контент олдсонгүй" алдааг ХАРУУЛЖ,
   * дараа нь дата ирэхэд гэнэт кино гарч ирдэг байв.
   *
   * Query АЖИЛЛААГҮЙ БАЙГАА нь "олдсонгүй" гэсэн үг БИШ — ачаалж
   * байна гэсэн үг. Иймд `isLoading`-д тэр төлөвийг НЭГТГЭНЭ.
   */
  return { ...q, isLoading: q.isLoading || authLoading || !slug };
}

/**
 * Сэтгэгдлийн жагсаалт.
 * ⚠️ `auth: true` — нэвтэрсэн бол өөрийн өгсөн санал (`myVote`) хамт ирнэ.
 * Backend нь OptionalJwtAuthGuard-тай тул зочин ч асуудалгүй үзнэ.
 */
export function useReviews(titleId: string, page = 1, sort: ReviewSort = 'helpful') {
  return useQuery({
    queryKey: ['reviews', titleId, page, sort],
    queryFn: () =>
      api<{ items: Review[]; total: number; page: number; totalPages: number }>(
        `/titles/${titleId}/reviews?page=${page}&sort=${sort}`,
      ),
    enabled: !!titleId,
    placeholderData: (prev) => prev,
  });
}

/** Одны тархалт — 1-10 бүрд хэдэн хүн өгсөн (график) */
export function useReviewStats(titleId: string) {
  return useQuery({
    queryKey: ['review-stats', titleId],
    queryFn: () => api<ReviewStats>(`/titles/${titleId}/reviews/stats`, { auth: false }),
    enabled: !!titleId,
  });
}

export function useMyReview(titleId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['my-review', titleId],
    queryFn: () => api<Review | null>(`/titles/${titleId}/reviews/mine`),
    enabled: enabled && !!titleId,
  });
}

/** Сэтгэгдэлтэй холбоотой бүх cache-ыг нэг дор шинэчилнэ */
function invalidateReviews(qc: ReturnType<typeof useQueryClient>, titleId: string) {
  qc.invalidateQueries({ queryKey: ['reviews', titleId] });
  qc.invalidateQueries({ queryKey: ['review-stats', titleId] });
  qc.invalidateQueries({ queryKey: ['my-review', titleId] });
  qc.invalidateQueries({ queryKey: ['title'] });
}

export function useSubmitReview(titleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; comment?: string; hasSpoiler?: boolean }) =>
      api(`/titles/${titleId}/reviews`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateReviews(qc, titleId),
  });
}

/** Сэтгэгдэлд хариу бичих */
export function useReplyReview(titleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reviewId: string; comment: string; hasSpoiler?: boolean }) =>
      api(`/reviews/${input.reviewId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ comment: input.comment, hasSpoiler: input.hasSpoiler }),
      }),
    onSuccess: () => invalidateReviews(qc, titleId),
  });
}

/** Хэрэгтэй / хэрэггүй санал (дахин дарвал цуцлагдана) */
export function useVoteReview(titleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reviewId: string; value: 1 | -1 }) =>
      api<{ helpful: number; notHelpful: number; score: number; myVote: number }>(
        `/reviews/${input.reviewId}/vote`,
        { method: 'POST', body: JSON.stringify({ value: input.value }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', titleId] }),
  });
}

/** Тохиромжгүй гэж мэдээлэх */
export function useReportReview() {
  return useMutation({
    mutationFn: (input: { reviewId: string; reason: string; note?: string }) =>
      api<{ ok: boolean; already?: boolean }>(`/reviews/${input.reviewId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: input.reason, note: input.note }),
      }),
  });
}

/** Өөрийн сэтгэгдэл/хариу устгах */
export function useDeleteReview(titleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => api(`/reviews/${reviewId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateReviews(qc, titleId),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    /* Хайлтын үр дүн 2 минут — ижил үг дахин бичихэд шууд */
    staleTime: 2 * 60_000,
    queryFn: () => api<TitleCard[]>(`/titles/search?q=${encodeURIComponent(q)}`, { auth: false }),
    enabled: q.length > 1,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => api<{ id: string; name: string; slug: string }[]>('/genres', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => api<PlanInfo[]>('/plans', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useMyList(enabled = true) {
  return useQuery({
    queryKey: ['my-list'],
    queryFn: () => api<TitleCard[]>('/my-list'),
    enabled,
  });
}

/**
 * Зочны "Дуртай" — localStorage-д зөвхөн id байдаг тул id-аар кино татна.
 * Нэвтэрсэн үед useMyList() ашиглана.
 */
export function useTitlesByIds(ids: string[], enabled = true) {
  const key = ids.join(',');
  return useQuery({
    queryKey: ['titles-by-ids', key],
    queryFn: () => api<TitleCard[]>(`/titles/by-ids?ids=${encodeURIComponent(key)}`),
    enabled: enabled && ids.length > 0,
  });
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export function useFaqs() {
  return useQuery({
    queryKey: ['faqs'],
    queryFn: () => api<Faq[]>('/faqs', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export interface BlogPostCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  views: number;
  tags: string[];
}

export interface BlogPostDetail extends BlogPostCard {
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export function useBlogPosts(page = 1) {
  return useQuery({
    queryKey: ['blog', page],
    /* Блог 10 минут — маш ховор өөрчлөгдөнө */
    staleTime: 10 * 60_000,
    queryFn: () =>
      api<{ items: BlogPostCard[]; total: number; page: number; totalPages: number }>(
        `/blog?page=${page}`,
        { auth: false },
      ),
    placeholderData: (prev) => prev,
  });
}

export function useBlogPost(slug: string) {
  const q = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => api<BlogPostDetail>(`/blog/${slug}`, { auth: false }),
    enabled: !!slug,
  });
  // ⚠️ `enabled: false` үед isLoading=false, data=undefined болдог тул
  // хуудас "олдсонгүй" алдаа FLASH хийдэг — үүнийг ачаалж буй гэж үзнэ.
  return { ...q, isLoading: q.isLoading || !slug };
}

export interface MyPayment {
  id: string;
  amount: number;
  originalAmount: number | null;
  couponCode: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
  /** Хэтэвч цэнэглэлтийн төлбөрт багц БАЙХГҮЙ (null) */
  plan: { name: string; durationDays: number } | null;
  isWalletTopup?: boolean;
  /** true = админ гараар олгосон эрх (төлбөргүй) */
  grantedByAdmin?: boolean;
  expiresAt?: string;
}

export function useMyPayments() {
  return useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api<MyPayment[]>('/payments/mine'),
  });
}

// ─── Хэтэвч ──────────────────────────────────────────────────────────────────

export interface WalletTx {
  id: string;
  type: 'TOPUP' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'PURCHASE' | 'REFUND';
  amount: number;
  balanceAfter: number;
  description: string;
  planId: string | null;
  planName: string | null;
  createdAt: string;
}

export interface MyRental {
  id: string;
  amount: number;
  expiresAt: string;
  createdAt: string;
  title: { id: string; title: string; slug: string; posterUrl: string | null; type: string };
}

/** Идэвхтэй ширхэгийн түрээсүүд (хугацаа дуусаагүй) */
export function useMyRentals(enabled = true) {
  return useQuery({
    queryKey: ['my-rentals'],
    queryFn: () => api<MyRental[]>('/rentals/mine'),
    enabled,
    staleTime: 30_000,
  });
}

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => api<{ balance: number }>('/wallet'),
  });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => api<WalletTx[]>('/wallet/transactions'),
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (input: { code: string; price: number }) =>
      api<{ valid: boolean; discount: number; finalPrice: number; discountType: 'PERCENT' | 'FIXED'; amount: number }>(
        '/coupons/validate',
        { method: 'POST', body: JSON.stringify(input), auth: false },
      ),
  });
}

// ─── Брэнд (лого) — админаас удирдагдана ──────────────────────────────────────

export interface BrandSettings {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  /**
   * Хэрэглэгч АНХ ОРОХОД аль өнгөний горим идэвхжих (админаас удирдана).
   * ⚠️ Хэрэглэгч header-ийн товчоор сонголт хийсэн бол ТҮҮНИЙХ давамгайлна.
   */
  defaultTheme?: 'dark' | 'light' | 'system';
}

/**
 * Сайтын лого/нэр. Бүх хуудсанд хэрэгтэй тул удаан кэшлэнэ.
 * ⚠️ `auth: false` — нэвтрээгүй зочинд ч лого харагдана.
 */
export function useBrand() {
  return useQuery({
    queryKey: ['brand'],
    queryFn: () => api<BrandSettings>('/settings/brand', { auth: false }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}
