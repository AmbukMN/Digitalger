import type { OrderStatus, UserRole } from '@digitalger/shared';

export interface CourseLesson {
  id: string;
  title: string;
  description?: string | null;
  durationSec: number | null;
  sortOrder: number;
  moduleId?: string | null;
  videoUrl?: string | null;
  isFreePreview: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
  sortOrder?: number;
  _count?: { products: number };
}

export interface Testimonial {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  content: string;
  rating: number;
}

export interface BundleItem {
  id: string;
  name: string;
  description?: string | null;
  label?: string | null;
  sortOrder: number;
  fileId?: string | null;
  fileIds?: string[];
}

export interface Bundle {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  downloadFileKey?: string | null;
  items: BundleItem[];
}

export interface ProductSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  type: string;
  featured: boolean;
  rating: number;
  ratingCount: number;
  downloadCount: number;
  viewCount?: number;
  thumbnailUrl: string | null;
  mainVideoUrl?: string | null;
  previewUrl?: string | null;
  lessonCount?: number | null;
  /** Хандалтын төрөл: LIFETIME = насан туршийн, DAYS = хязгаартай хоног */
  accessType?: 'LIFETIME' | 'DAYS' | null;
  /** accessType=DAYS үед хандалтын хоногийн тоо (жишээ: 90, 180, 365) */
  accessDays?: number | null;
  /** Зөвхөн админд харагдах (туршилт) — нэвтэрсэн ADMIN л харна, хэрэглэгчдэд нуугдана */
  adminOnly?: boolean;
  category?: { id: string; name: string; slug: string };
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  desktopImageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  bgColor: string | null;
}

export interface MenuItem {
  id: string;
  label: string;
  url: string | null;
  pageSlug: string | null;
  target: string;
  openInNew: boolean;
}

export interface WishlistItem {
  id: string;
  createdAt: string;
  product: ProductSummary;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string;
  coverImageUrl?: string | null;
  publishedAt?: string | null;
  tags: string[];
  authorName: string;
  viewCount?: number;
  createdAt: string;
}

export interface ProductDetail extends ProductSummary {
  images?: { id: string; url: string; alt: string | null; isPrimary: boolean; videoUrl?: string | null; sortOrder: number }[];
  files?: { id: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null; sortOrder: number }[];
  course?: {
    modules: { id: string; title: string; sortOrder: number; lessons: CourseLesson[] }[];
    lessons: CourseLesson[];
  };
  reviews?: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt?: string;
    user: { id: string; name: string | null; image: string | null };
  }[];
  faqs?: FAQ[];
  testimonials?: Testimonial[];
  bundles?: Bundle[];
  howToUse?: string | null;
  howToUseSteps?: { title: string; description: string }[];
  whatsIncluded?: string | null;
  discountEndsAt?: string | null;
  videoUrl?: string | null;
  proofImageUrl?: string | null;
  proofQuote?: string | null;
  proofText?: string | null;
  proofAuthorName?: string | null;
  proofAuthorRole?: string | null;
  downloadFileKey?: string | null;
}

export interface PaginatedProducts {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | string;
  image: string | null;
  phone?: string | null;
  isGuest?: boolean;
  oauthProvider?: string | null;
  emailVerified?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface OrderItem {
  id: string;
  price: string | number;
  product: ProductSummary;
}

export interface Order {
  id: string;
  total: string | number;
  currency: string;
  status: OrderStatus;
  couponCode?: string | null;
  createdAt: string;
  items: OrderItem[];
  devMode?: boolean;
}

export interface PurchasedProduct {
  orderId: string;
  purchasedAt: string;
  /** Хандалтын дуусах огноо (accessType=DAYS бол). LIFETIME бол null/undefined. */
  expiresAt?: string | null;
  /** Хандалтын хугацаа дууссан эсэх (backend тооцоолж буцаана) */
  isExpired?: boolean;
  /** Хандалтын төрөл — LIFETIME = насан туршийн, DAYS = хязгаартай */
  accessType?: 'LIFETIME' | 'DAYS' | null;
  product: {
    id: string;
    title: string;
    slug: string;
    type: string;
    thumbnailUrl?: string | null;
    downloadFileKey?: string | null;
    files: { id: string; fileName: string; sortOrder: number }[];
    // bundle доторх (cross-product) файлууд — нэрийн хамт backend-ээс resolve хийгдэж ирнэ
    bundleFiles?: { id: string; fileName: string; sortOrder: number }[];
    bundles?: {
      id: string;
      title: string;
      description?: string | null;
      downloadFileKey?: string | null;
      items: {
        id: string;
        name: string;
        description?: string | null;
        label?: string | null;
        fileId?: string | null;
        fileIds: string[];
      }[];
    }[];
  };
}

export interface PaymentInitiateResult {
  devMode?: boolean;
  orderId: string;
  paymentId: string;
  invoiceId?: string;
  identifier?: string;
  status?: string;
  message?: string;
  qrText?: string;
  qrImage?: string;
  urls?: { name: string; link: string; logo: string }[];
}
