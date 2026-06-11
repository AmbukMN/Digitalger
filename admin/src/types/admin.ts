import type { OrderStatus, UserRole } from '@digitalger/shared';

export interface EmailStats {
  configured: boolean;
  sentThisMonth: number;
  sentLastMonth: number;
  sentTwoMonthsAgo: number;
  monthlyLimit: number;
  queueLength: number;
  provider?: string;
  active?: boolean; // одоо идэвхтэй провайдер эсэх
  // ── SES 24 цагийн (өдрийн) sending quota — backend getSendQuota()-аас ирвэл ──
  sentToday?: number;       // сүүлийн 24 цагт илгээсэн (SentLast24Hours эсвэл EmailLog тоо)
  dailyLimit?: number;      // Max24HourSend (default 50000)
  maxSendRate?: number;     // секундэд илгээх дээд хэмжээ (Max send rate, ж: 14/сек)
  // ── Reputation (SES account-level) — байвал ──
  bounceRate?: number;      // 0–1 (ж: 0.02 = 2%)
  complaintRate?: number;   // 0–1
}

// Resend статистик — EmailStats-тэй ижил бүтэц
export type ResendStats = EmailStats;

// Bulk кампанит ажлын илгээлтийн явц (queue background)
// Backend getCampaignProgress буцаах формат (Redis тоологчид).
export interface EmailCampaignProgress {
  campaign: string;
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
}

// Админаас хэрэглэгчид үнэгүй идэвхжүүлсэн бүтээгдэхүүн
export interface GrantedProduct {
  orderId: string;
  grantedAt: string;
  productId: string;
  title: string;
  type: string;
  price: number | string;
  imageKey: string | null;
}

export interface TopDownloadedProduct {
  id: string;
  title: string;
  type: string;
  categoryName: string | null;
  price: number | string;
  realDownloadCount: number;
  imageUrl: string | null;
}

export interface DashboardStats {
  stats: {
    users: number;
    products: number;
    orders: number;
    revenue: number;
    ordersThisMonth: number;
    newUsersThisMonth: number;
    pendingExpiredCount: number;
    totalRealDownloads: number;
    revenueThisMonth: number;
    subscribersTotal: number;
    subscribersThisMonth: number;
  };
  // Өмнөх сартай харьцуулсан өсөлтийн хувь (null = өмнөх өгөгдөлгүй)
  trends: {
    orders: number | null;
    users: number | null;
    revenue: number | null;
  };
  recentOrders: AdminOrder[];
  monthlyRevenue: { month: string; revenue: number }[];
  emailStats: EmailStats;
  resendStats?: ResendStats;
  topDownloaded: TopDownloadedProduct[];
  subscribersBySource: { source: string; count: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  image: string | null;
  phone?: string | null;
  isGuest?: boolean;
  blocked?: boolean;
  oauthProvider?: string | null;
  createdAt: string;
  _count?: { orders: number; downloads?: number };
}

export interface AdminUserDetail extends AdminUser {
  emailVerified: string | null;
  updatedAt: string;
  _count: { orders: number; reviews: number; downloads: number };
}

// Хэрэглэгчийн дэлгэрэнгүй popup-ийн бүх дата (backend getUserDetail)
export interface UserDetailOrderItem {
  id: string;
  price: string | number;
  product: { id: string; title: string; slug: string } | null;
}
export interface UserDetailOrder {
  id: string;
  total: string | number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  source: string;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string;
  items: UserDetailOrderItem[];
  payments: { status: string; createdAt: string }[];
}
export interface UserDetailDownload {
  id: string;
  fileName: string;
  productTitle: string | null;
  productSlug: string | null;
  source: 'paid' | 'free' | 'bundle' | string;
  createdAt: string;
}
export interface UserDetailEvent {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  device: string | null;
  createdAt: string;
}
export interface UserDetailAudit {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actor: string;
  createdAt: string;
}
export interface UserDetailSearch {
  id: string;
  query: string;
  results: number;
  createdAt: string;
}
export interface UserDetailPageView {
  id: string;
  path: string;
  device: string | null;
  referrer: string | null;
  createdAt: string;
}
// ─── Чат (web/facebook AI чатбот) ────────────────────────────────────────────
export interface UserDetailChatMessage {
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}
export interface UserDetailChatConversation {
  id: string;
  channel: 'web' | 'facebook';
  userName?: string | null;
  lastMessageAt: string;
  messages: UserDetailChatMessage[];
}

// Хэрэглэгчийн LTV (нийт зарцуулсан / худалдан авалт)
export interface UserDetailLtv {
  totalSpent: number | string;
  orderCount: number;
  avgOrder: number | string;
  firstPurchase?: string | null;
  lastPurchase?: string | null;
}

// Сонирхол (хамгийн их үзсэн ангилал / бүтээгдэхүүн)
export interface UserDetailInterests {
  topCategories: { name: string; count: number }[];
  topProducts: { title: string; slug: string; views: number }[];
}

// Чатын conversion (чатласан → дараа нь худалдсан эсэх)
export interface UserDetailChatConversion {
  chatted: boolean;
  purchasedAfterChat: boolean;
}

export interface AdminUserFullDetail {
  user: {
    id: string;
    email: string;
    phone: string | null;
    name: string | null;
    image: string | null;
    role: UserRole;
    isGuest: boolean;
    blocked: boolean;
    oauthProvider: string | null;
    emailVerified: string | null;
    pendingEmail: string | null;
    createdAt: string;
    updatedAt: string;
  };
  orders: UserDetailOrder[];
  downloads: UserDetailDownload[];
  viewedProducts: UserDetailEvent[];
  clickedLinks: UserDetailEvent[];
  cartedProducts: UserDetailEvent[];
  purchasedEvents: UserDetailEvent[];
  searchHistory: UserDetailSearch[];
  pageViews: UserDetailPageView[];
  devices: { device: string; count: number }[];
  auditLogs: UserDetailAudit[];
  summary: {
    ordersTotal: number;
    statusSummary: Record<string, number>;
    downloadsTotal: number;
    viewsTotal: number;
    clicksTotal: number;
    cartsTotal: number;
    searchesTotal: number;
    pageViewsTotal: number;
    paidOrders: number;
    pendingOrders: number;
  };
  // ─── ШИНЭ (backend бэлэн биш бол optional) ─────────────────────────────────
  chatConversations?: UserDetailChatConversation[];
  ltv?: UserDetailLtv;
  interests?: UserDetailInterests;
  chatConversion?: UserDetailChatConversion;
}

// ─── Багийн админ (Staff management) — зөвхөн SUPERADMIN ──────────────────────
// EDITOR/ADMIN дүртэй админ ажилтан. SUPERADMIN-ийг ч жагсаалтад буцааж болох тул
// role-ийг өргөн (string) авна; UI талд role/block/delete товчийг нуудаг.
export interface AdminStaff {
  id: string;
  email: string;
  name: string | null;
  role: 'EDITOR' | 'ADMIN' | 'SUPERADMIN' | string;
  blocked: boolean;
  image: string | null;
  createdAt: string;
}

// ─── Granular permission (resource бүрээр) ───────────────────────────────────
// Админ ажилтан бүрд resource (products/orders/...) тус бүрд View/Create/Edit/
// Delete эрхийг тусад нь тохируулна. Backend нь resource string-ээр хадгална.
export type AdminPermissionResource =
  | 'products'
  | 'categories'
  | 'product-types'
  | 'blog'
  | 'banners'
  | 'testimonials'
  | 'faqs'
  | 'coupons'
  | 'pages'
  | 'menu'
  | 'orders'
  | 'reviews';

export interface AdminStaffPermission {
  resource: AdminPermissionResource | string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductImage {
  id: string;
  productId: string;
  fileKey: string;
  url: string;
  videoUrl?: string | null;
  alt?: string | null;
  sortOrder: number;
  isPrimary: boolean;
  variants?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
}

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  type: string;
  categoryId: string;
  category?: AdminCategory;
  published: boolean;
  featured: boolean;
  // Зөвхөн админд харагдах (туршилт) — чеклэвэл зөвхөн нэвтэрсэн ADMIN л харна,
  // энгийн хэрэглэгч/зочинд бүтээгдэхүүн нуугдана
  adminOnly?: boolean;
  // Хандалтын хугацаа: LIFETIME = насан туршийн, DAYS = тодорхой хоногийн дараа эрх дуусна
  accessType?: 'LIFETIME' | 'DAYS';
  accessDays?: number | null;
  previewUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  thumbnailUrl?: string | null;
  howToUse?: string | null;
  howToUseSteps?: { title: string; description: string }[];
  whatsIncluded?: string | null;
  discountEndsAt?: string | null;
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  realDownloadCount?: number;
  viewCount?: number;
  proofImageUrl?: string | null;
  proofQuote?: string | null;
  proofText?: string | null;
  proofAuthorName?: string | null;
  proofAuthorRole?: string | null;
  downloadFileKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Захиалгын эх сурвалж — "PURCHASE" (мөнгөөр) | "ADMIN_GRANT" (админ үнэгүй идэвхжүүлсэн gift)
export type OrderSource = 'PURCHASE' | 'ADMIN_GRANT';
// Цуцлалтын эх сурвалж — "USER" (хэрэглэгч) | "SYSTEM" (cron автомат) | "ADMIN" (админ гараар)
export type OrderCancelledBy = 'USER' | 'SYSTEM' | 'ADMIN';

export interface AdminOrder {
  id: string;
  total: number | string;
  currency: string;
  status: OrderStatus;
  couponCode?: string | null;
  // Эх сурвалж / gift / цуцлалтын тодотгол (backend order багана)
  source?: OrderSource | string | null;
  grantedByAdminId?: string | null;
  cancelledBy?: OrderCancelledBy | string | null;
  cancelledAt?: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null; image?: string | null };
  items: Array<{
    id: string;
    product: { title: string; slug: string; previewUrl?: string | null; price?: number | string; compareAtPrice?: number | string | null; discountEndsAt?: string | null; downloadCount?: number | null };
  }>;
  payments?: Array<{
    id: string;
    amount: number | string;
    status: string;
  }>;
}

export interface AdminPaymentRow {
  id: string;
  amount: number | string;
  status: string;
  qpayPaymentId?: string | null;
  createdAt: string;
  order: {
    id: string;
    status: string;
    user: { id: string; email: string; name: string | null; image?: string | null };
  };
}

export interface ThemeSettings {
  id: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  layoutMode: string;
  defaultTheme: 'system' | 'light' | 'dark';
}

export interface SiteSettings {
  id: string;
  siteName: string;
  siteUrl: string;
  supportEmail: string | null;
  logoUrl: string | null;

  // SEO
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCardType: string | null;
  robotsNoIndex: boolean;
  robotsNoFollow: boolean;
  canonicalUrl: string | null;

  // Analytics
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  fbPixelId: string | null;
  googleSiteVerification: string | null;
  naverSiteVerification: string | null;

  // Sitemap
  sitemapEnabled: boolean;
  sitemapChangeFreq: string | null;
  sitemapPriority: string | null;

  // Social
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialThreads: string | null;
  socialTelegram: string | null;
  socialWhatsapp: string | null;
  socialTiktok: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;

  // Сертификатын гарын үсэг (бүх сертификат дээр харагдана)
  certSignatureUrl: string | null;
  certSignerName: string | null;
  certSignerTitle: string | null;
}

export interface AdminProductTypeConfig {
  id: string;
  value: string;
  label: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  desktopImageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  sortOrder: number;
  active: boolean;
  bgColor: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMenuItem {
  id: string;
  label: string;
  url: string | null;
  pageSlug: string | null;
  sortOrder: number;
  active: boolean;
  target: string;
  openInNew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
  _count?: { products: number };
}

export interface AdminTestimonial {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  content: string;
  rating: number;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  _count?: { products: number };
}

export interface AdminBundleItem {
  id: string;
  bundleId: string;
  name: string;
  description?: string | null;
  label?: string | null;
  fileId?: string | null;
  fileIds?: string[];
  sortOrder: number;
}

export interface AdminBundle {
  id: string;
  productId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  downloadFileKey?: string | null;
  items: AdminBundleItem[];
}

export interface AdminLessonResource {
  id: string;
  lessonId: string;
  fileKey: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sortOrder: number;
  url?: string | null;
}

export interface AdminLesson {
  id: string;
  courseId: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  content?: string | null;
  videoKey?: string | null;
  videoUrl?: string | null;
  videoStreamId?: string | null;
  streamStatus?: string | null;
  // Видео thumbnail/poster — admin upload (R2 key) + resolve хийсэн public url.
  posterKey?: string | null;
  posterUrl?: string | null;
  durationSec?: number | null;
  isFreePreview: boolean;
  sortOrder: number;
  resources?: AdminLessonResource[];
}

export interface AdminCourseModule {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
  lessons: AdminLesson[];
}

// ─── Quiz (хичээлийн дараах шалгалт) ─────────────────────────────────────────
export interface AdminQuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  sortOrder?: number;
}

export interface AdminQuiz {
  id: string;
  lessonId: string;
  title: string;
  passScore: number;
  questions: AdminQuizQuestion[];
  createdAt?: string;
}

// Quiz хадгалах body (id-гүй — backend upsert хийнэ)
export interface AdminQuizInput {
  title: string;
  passScore: number;
  questions: AdminQuizQuestion[];
}

// ─── Хичээлийн Q&A модерац ───────────────────────────────────────────────────
// Асуулт/хариултад хавсаргасан файл (R2). Зураг бол preview, бусад нь татах.
// Backend resolveQaAttachment-тай талбарын нэр тохирно: { key, name, mimeType, size, url }.
export interface AdminQaAttachment {
  key?: string | null;
  url?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface AdminLessonAnswer {
  id: string;
  questionId: string;
  answer: string;
  isInstructor: boolean;
  createdAt: string;
  user?: { id: string; name: string | null; email?: string | null; image?: string | null } | null;
  // Хариултад хавсаргасан файл (байж болно)
  attachment?: AdminQaAttachment | null;
}

// Q&A асуулт холбоотой хичээл + бүтээгдэхүүн
export interface AdminQaLessonRef {
  id: string;
  title: string;
  product?: { id: string; title: string; slug: string } | null;
}

export interface AdminLessonQuestion {
  id: string;
  lessonId?: string;
  question: string;
  isPinned: boolean;
  createdAt: string;
  // Backend жагсаалт буцаах туслах талбарууд
  answered?: boolean;
  answerCount?: number;
  // Admin уншаагүй (хэрэглэгчээс шинэ асуулт/хариулт) — badge онцлоход.
  unread?: boolean;
  user?: { id: string; name: string | null; email?: string | null; image?: string | null } | null;
  answers: AdminLessonAnswer[];
  // Аль хичээл / бүтээгдэхүүний асуулт болохыг танихад
  lesson?: AdminQaLessonRef | null;
  // Асуултад хавсаргасан файл (байж болно)
  attachment?: AdminQaAttachment | null;
}

// GET /admin/lessons/questions хариу (pagination)
export interface AdminLessonQuestionsList {
  items: AdminLessonQuestion[];
  total: number;
  // Admin уншаагүй нийт асуултын тоо (sidebar/жагсаалт badge-д).
  unreadTotal?: number;
  page: number;
  pageSize: number;
}

// ─── Review / Сэтгэгдэл (бүтээгдэхүүний үнэлгээ) ─────────────────────────────
export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
  product: { id?: string; title: string; slug: string } | null;
  user: { id?: string; name: string | null; email: string; image?: string | null } | null;
}

// ─── Таталт (DownloadLog) ───────────────────────────────────────────────────
export interface AdminDownloadLog {
  id: string;
  createdAt: string;
  source: 'free' | 'paid' | 'bundle' | string;
  fileName: string | null;
  ip: string | null;
  userAgent: string | null;
  product: { title: string; slug: string } | null;
  // null = нэвтрээгүй зочин (IP-ээр ялгана)
  user: { name: string | null; email: string } | null;
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number | string;
  minPrice?: number | string | null;
  maxUses?: number | null;
  usedCount: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Subscribers (имэйл захиалагч) ───────────────────────────────────────────
export interface AdminSubscriberCategory {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  count: number;
  createdAt: string;
}

export interface AdminSubscriber {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER' | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'UNSUBSCRIBED';
  source: string | null;
  tags: string[];
  isActive: boolean;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductFile {
  id: string;
  productId: string;
  fileName: string;
  fileKey: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface UploadVariantInfo {
  size: string;
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
}

// —— SEO override (тогтмол хуудсуудын custom OG meta) ——
export interface SeoOverride {
  id: string;
  path: string;
  title?: string | null;
  description?: string | null;
  ogImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeoOverrideInput {
  id?: string;
  path: string;
  title?: string | null;
  description?: string | null;
  ogImageUrl?: string | null;
}

// dropdown-д ойлгомжтой нэг мөр (backend AllowedPath-тэй тааруулсан)
export interface SeoAllowedPath {
  path: string;
  label: string;
}

// бүлэглэсэн хариу (backend AllowedPathsGrouped — Тогтмол / Ангилал / Блог)
export interface SeoAllowedPathsGrouped {
  static: SeoAllowedPath[];
  categories: SeoAllowedPath[];
  blog: SeoAllowedPath[];
}

export interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  variantData?: UploadVariantInfo[];
  thumbnailUrl?: string;
  thumbnailKey?: string;
}

export interface AdminProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueJobSummary {
  id: string | number;
  data: Record<string, unknown>;
  failedReason?: string;
  returnvalue?: unknown;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

export interface QueueStatus {
  queue: {
    name: string;
    isPaused: boolean;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  db: {
    pending: number;
    processing: number;
    done: number;
    failed: number;
  };
  recentFailed: QueueJobSummary[];
  recentCompleted: QueueJobSummary[];
}
