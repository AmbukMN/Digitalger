import type { OrderStatus, UserRole } from '@digitalger/shared';

export interface EmailStats {
  configured: boolean;
  sentThisMonth: number;
  sentLastMonth: number;
  sentTwoMonthsAgo: number;
  monthlyLimit: number;
  queueLength: number;
}

export interface DashboardStats {
  stats: {
    users: number;
    products: number;
    orders: number;
    revenue: number;
    ordersThisMonth: number;
    newUsersThisMonth: number;
  };
  recentOrders: AdminOrder[];
  monthlyRevenue: { month: string; revenue: number }[];
  emailStats: EmailStats;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  image: string | null;
  createdAt: string;
  _count?: { orders: number };
}

export interface AdminUserDetail extends AdminUser {
  emailVerified: string | null;
  updatedAt: string;
  _count: { orders: number; reviews: number; downloads: number };
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
  user: { id: string; email: string; name: string | null };
  items: Array<{
    id: string;
    product: { title: string; slug: string };
  }>;
  payments?: Array<{
    id: string;
    amount: number | string;
    status: string;
  }>;
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

export interface AdminLesson {
  id: string;
  courseId: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  videoKey?: string | null;
  videoUrl?: string | null;
  durationSec?: number | null;
  isFreePreview: boolean;
  sortOrder: number;
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

export interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
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
