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
}

// Resend статистик — EmailStats-тэй ижил бүтэц
export interface ResendStats extends EmailStats {}

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
  fileId: string;
  fileName: string;
  productTitle: string | null;
  productSlug: string | null;
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

export interface AdminOrder {
  id: string;
  total: number | string;
  currency: string;
  status: OrderStatus;
  couponCode?: string | null;
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
