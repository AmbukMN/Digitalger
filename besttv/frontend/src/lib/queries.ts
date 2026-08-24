import {
  keepPreviousData,
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
  /**
   * Интро эхлэх/дуусах секунд — ХОЁУЛАА байвал л «Интро алгасах»
   * товч гарна (нэг нь дутуу бол буруу газар үсэрнэ).
   */
  introStartSec?: number | null;
  introEndSec?: number | null;
  /** Титр эхлэх секунд — эндээс «Дараагийн анги» карт гарна */
  outroStartSec?: number | null;
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
  /**
   * ⚠️ YouTube трейлерийн key — ЗӨВХӨН манай HLS трейлер БАЙХГҮЙ үед ирнэ.
   * Байвал `TrailerModal` нь VideoPlayer-ийн оронд YouTube embed үзүүлнэ.
   */
  trailerYoutubeKey?: string | null;
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
/** Нүүрний ДУНД баннер — админ панелиас удирдана */
export interface HomeBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  /** Хэддэх жанрын эгнээний ДАРАА орох (0 = хамгийн дээр) */
  position: number;
  imageUrl: string | null;
  /** ⚠️ Хоосон бол `imageUrl` — өргөн зураг утсанд нарийн харагдана */
  mobileImageUrl: string | null;
}

/**
 * ⚠️ Нүүрний датанаас ТУСДАА query — баннер нь БҮХ зочинд ижил
 * (хэрэглэгчээс хамаарахгүй) тул `useHome`-той нэгтгэвэл нэвтрэлт
 * тодрох бүрд дахин татагдана.
 */
export function useHomeBanners() {
  return useQuery({
    queryKey: ['home-banners'],
    queryFn: () => api<HomeBanner[]>('/banners'),
    staleTime: 5 * 60_000,
  });
}

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

/**
 * ⚠️ `useCatalog` ХАСАГДСАН — `useCatalogInfinite` орлосон.
 * Хуудаслалттай хувилбар нь хаанаас ч дуудагдахаа больсон.
 */

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
export function useTitleDetail(slug: string, initial?: TitleDetail) {
  const userId = useAuth((s) => s.user?.id);
  const authLoading = useAuth((s) => s.loading);
  const q = useQuery({
    queryKey: ['title', slug, userId ?? 'guest'],
    queryFn: () => api<TitleDetail>(`/titles/${slug}`, { auth: true }),
    /**
     * ⚠️⚠️ SSR-ЭЭС ИРСЭН ЗОЧНЫ ДАТА — зөвхөн ЗОЧИН үед.
     *
     * Сервер `/titles/:slug`-ыг аль хэдийн татдаг байсан ч зөвхөн
     * meta tag-д ашиглаад ХАЯДАГ байв. Улмаас browser ДАХИН татах
     * хүртэл HTML-д зөвхөн skeleton — Googlebot/Facebook/Bing бодит
     * контент ОГТ ХАРДАГГҮЙ, хэрэглэгч 4 нэмэлт алхам хүлээдэг байв.
     *
     * ⚠️ НЭВТЭРСЭН хэрэглэгчид ОГТ өгөхгүй: зочны хариунд
     * `hasAccess:false` байдаг тул эрхтэй хүнд «Багц авах» товч
     * агшин зуур гарч, төлбөр төлсөн атлаа түгжээтэй мэт харагдана.
     */
    initialData: !userId && initial ? initial : undefined,
    /* ⚠️ SSR дата 60 сек ISR-тэй тул тэр хугацаанд дахин татахгүй */
    initialDataUpdatedAt: initial ? Date.now() : undefined,
    enabled: !!slug && !authLoading,
    /**
     * ⚠️ Хэрэглэгч солигдоход (нэвтрэх/гарах) `queryKey` өөрчлөгдөж ШИНЭ
     * кэш үүсдэг тул хуудас гэнэт skeleton руу үсэрдэг. Өмнөх датаг
     * түр хадгалснаар тэр FLASH арилна.
     *
     * ⚠️⚠️ ГЭХДЭЭ ЭРХИЙН ТАЛБАРУУДЫГ ЗӨӨХГҮЙ (бодит гомдол: «эрхтэй
     * байхад Багц авах гарч байна»).
     *
     * Хэрэглэгч зочноор хуудсыг нээгээд ДАРАА нь нэвтрэхэд placeholder
     * нь ЗОЧНЫ хариуг (`hasAccess: false`) хэвээр харуулдаг байв.
     * Шинэ хариу ирэх хүртэл «Багц авах» товч гарч, хэрэглэгч төлбөр
     * төлсөн атлаа түгжээтэй мэт харна.
     *
     * Зураг/тайлбар зэрэг ТОГТМОЛ талбарыг үлдээж, ЭРХЭЭС хамаарах
     * талбаруудыг `undefined` болгоно — UI тэдгээрийг «ачаалж байна»
     * гэж үзэж товчийг харуулахгүй, буруу мэдээлэл ХЭЗЭЭ Ч гарахгүй.
     */
    placeholderData: (prev) =>
      prev
        ? ({
            ...prev,
            hasAccess: undefined,
            rental: undefined,
            progress: undefined,
            inMyList: undefined,
          } as unknown as TitleDetail)
        : undefined,
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
  /**
   * ⚠️⚠️ SSR ДАТА БАЙВАЛ «АЧААЛЖ БАЙНА» ГЭЖ ХЭЛЭХГҮЙ.
   *
   * `authLoading` нь эхлэлийн утга `true` тул SSR болон эхний render-т
   * `isLoading` мөнхөд `true` болж, сервер `initialData` өгсөн ч
   * компонент SKELETON рендерлэдэг байв. Улмаас Googlebot HTML-д
   * бодит контент (h1, тайлбар) ОГТ ХАРАХГҮЙ хэвээр үлдэж байв.
   *
   * Дата гарт байгаа бол ачаалалт ДУУССАН — эрхийн талбарууд дараа
   * шинэчлэгдэнэ (`placeholderData` тэдгээрийг `undefined` болгодог
   * тул буруу мэдээлэл ХЭЗЭЭ Ч гарахгүй).
   */
  return { ...q, isLoading: !q.data && (q.isLoading || authLoading || !slug) };
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
  /**
   * ⚠️⚠️ ЭРЭМБЭЛЖ түлхүүр үүсгэнэ.
   *
   * `ids` нь `Set`-ээс задарсан массив тул ижил агуулгатай ч ДАРААЛАЛ
   * өөр байж болно (нэмэх/хасах дарааллаас хамаарна). Эрэмбэлээгүй бол
   * ижил жагсаалтад ӨӨР queryKey үүсч, кэш ажиллахгүй.
   */
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: ['titles-by-ids', key],
    queryFn: () => api<TitleCard[]>(`/titles/by-ids?ids=${encodeURIComponent(key)}`),
    enabled: enabled && ids.length > 0,
    /**
     * ⚠️ Зочин ♥ дарж НЭГ кино хасахад БҮХ жагсаалт дахин татагдаж,
     * бүх постер анивчиж layout үсэрдэг байв (20 кинотой хүнд
     * харагдахуйц). `keepPreviousData` нь хуучин датаг байрандаа
     * үлдээж, шинэ нь ирэхэд л солино.
     */
    placeholderData: keepPreviousData,
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
  /**
   * Төлбөрийн арга — QPAY | CARD | BANK | WALLET | GRANT.
   * ⚠️ `CARD` нь карт/Apple Pay/Google Pay/WeChat-ыг хамарна
   *    (зуучлагчийн нэр хэрэглэгчид харагдахгүй).
   */
  provider?: 'QPAY' | 'CARD' | 'BANK' | 'WALLET' | 'GRANT';
  /** Ширхэгээр түрээслэсэн киноны нэр (байвал) */
  titleName?: string | null;
  rentalTitleId?: string | null;
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
      api<{
        valid: boolean;
        discount: number;
        finalPrice: number;
        discountType: 'PERCENT' | 'FIXED';
        amount: number;
        /** ⚠️ Энэ дүнгээс доош багцад купон ХҮЧИНГҮЙ */
        minPrice: number;
      }>(
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

// ─── УРАМШУУЛАЛ ──────────────────────────────────────────────────────────────

export type PromotionType = 'EXTRA_DAYS' | 'DISCOUNT' | 'GIFT_PLAN' | 'WALLET_BONUS';

export interface AppliedPromotion {
  id: string;
  name: string;
  shortText: string;
  type: PromotionType;
  /** Эцсийн үнэ (урамшуулал тусгасан) */
  finalPrice: number;
  /** Хямдралгүй үнэ — зураастай харуулна */
  originalPrice: number;
  /** Нийт хоног (үндсэн + бонус) */
  totalDays: number;
  bonusDays: number;
  giftPlanName: string | null;
  blockCoupons: boolean;
  endsAt: string;
}

export interface PromotionBanner {
  id: string;
  name: string;
  shortText: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  endsAt: string;
}

/**
 * Багц бүрд тохирох урамшуулал (planId → урамшуулал).
 *
 * ⚠️ `auth: true` (default) — нэвтэрсэн хэрэглэгчид `newUsersOnly`
 * болон `maxPerUser` шалгагдана. Зочинд ч ажиллана (OptionalJwtGuard).
 *
 * ⚠️ `staleTime` БОГИНО — урамшуулал хугацаа дуусахад хуучин үнэ
 * харуулбал хэрэглэгч гомдоно.
 */
export function usePlanPromotions() {
  return useQuery({
    queryKey: ['promotions', 'for-plans'],
    queryFn: () => api<Record<string, AppliedPromotion>>('/promotions/for-plans'),
    staleTime: 60_000,
  });
}

export function usePromotionBanners() {
  return useQuery({
    queryKey: ['promotions', 'banners'],
    queryFn: () => api<PromotionBanner[]>('/promotions/banners', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

// ─── ДАНСААР ТӨЛӨХ ───────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  bankName: string;
  logoUrl: string | null;
  accountNumber: string;
  /** ⚠️ IBAN нь дансны дугаараас ТУСДАА — зарим банк IBAN шаарддаг */
  iban: string | null;
  accountName: string;
}

export interface BankInfo {
  enabled: boolean;
  note: string;
  /** Төлбөрийн баримт (screenshot) заавал эсэх */
  requireReceipt: boolean;
  accounts: BankAccount[];
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank', 'accounts'],
    queryFn: () => api<BankInfo>('/bank/accounts', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

// ─── МЭДЭГДЭЛ ────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'PLAN_ACTIVATED'
  | 'PLAN_EXPIRING'
  | 'WALLET_TOPUP'
  | 'PROMOTION_APPLIED'
  | 'INFO';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: AppNotification[]; unread: number }>('/notifications'),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * ⚠️ Зөвхөн ТОО — хонхны улаан цэгт. Бүтэн жагсаалт татвал
 * хэрэггүй өгөгдөл 60 секунд тутам дамжина.
 */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ unread: number }>('/notifications/unread-count'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
