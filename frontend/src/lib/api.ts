import type {
  AuthTokens,
  AuthUser,
  Banner,
  BlogPost,
  Category,
  MenuItem,
  Order,
  PaginatedProducts,
  PaymentInitiateResult,
  ProductDetail,
  ProductSummary,
  PurchasedProduct,
  Testimonial,
  WishlistItem,
} from '@/types/api';
import { API_URL } from './constants';

type FetchOptions = RequestInit & { token?: string };

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, signal, ...rest } = options;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    // signal дамжуулаагүй бол default 15сек timeout — API удаан/унавал
    // хязгааргүй хүлээж UI гацахаас сэргийлнэ
    signal: signal ?? AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(body || res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

// —— Products ——
export const productsApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    category?: string;
    featured?: boolean;
    type?: string;
    types?: string;
    sortBy?: 'newest' | 'discount' | 'rating' | 'downloads';
    onSale?: boolean;
  }) => {
    const query = qs({
      page: params?.page,
      pageSize: params?.pageSize,
      category: params?.category,
      featured: params?.featured,
      sortBy: params?.sortBy,
      onSale: params?.onSale,
      ...(params?.types ? { types: params.types } : { type: params?.type }),
    });
    return request<PaginatedProducts>(`/products${query}`);
  },

  search: (q: string, page = 1, pageSize = 12) =>
    request<PaginatedProducts>(
      `/products/search${qs({ q, page, pageSize })}`,
    ),

  bySlug: (slug: string) => request<ProductDetail>(`/products/${slug}`),
  incrementView: (slug: string) =>
    request<{ ok: boolean }>(`/products/${slug}/view`, { method: 'POST' }).catch(() => null),
  suggested: (slug: string, count = 4) => request<ProductSummary[]>(`/products/${slug}/suggested?count=${count}`),
};

// —— Categories ——
export const categoriesApi = {
  list: () => request<Category[]>('/categories'),
  bySlug: (slug: string) => request<Category & { products?: PaginatedProducts['items'] }>(`/categories/${slug}`),
};

// —— Product Types ——
export interface ProductTypeConfig {
  id: string;
  value: string;
  label: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  active: boolean;
}

export const productTypesApi = {
  list: () => request<ProductTypeConfig[]>('/product-types'),
};

// —— Auth ——
export const authApi = {
  register: (body: { email: string; password: string; name?: string; phone?: string }) =>
    request<{ message: string; email: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email?: string; phone?: string; userId?: string; password: string }) =>
    request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  oauthLogin: (body: { provider: string; providerAccountId: string; email?: string; name?: string; image?: string }) =>
    request<AuthTokens & { user: AuthUser }>('/auth/oauth', { method: 'POST', body: JSON.stringify(body) }),

  loginAsGuest: () =>
    request<AuthTokens & { user: AuthUser; tempEmail: string; tempPassword: string }>('/auth/guest', { method: 'POST' }),

  validate: (body: { email: string; password?: string }) =>
    request<{ valid: boolean; user: AuthUser | null }>('/auth/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  refresh: (refreshToken: string) =>
    request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  verifySignupOtp: (body: { email: string; otp: string }) =>
    request<AuthTokens & { user: AuthUser }>('/auth/verify-signup-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sendVerifyOtp: (token: string) =>
    request<{ message: string }>('/auth/send-verify-otp', { method: 'POST', token }),

  verifyEmail: (token: string, otp: string) =>
    request<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      token,
      body: JSON.stringify({ otp }),
    }),

  // Имэйл солих хүсэлт — шинэ имэйл рүү OTP илгээнэ (баталгаажтал email солихгүй)
  requestEmailChange: (token: string, email: string) =>
    request<{ message: string }>('/auth/request-email-change', {
      method: 'POST',
      token,
      body: JSON.stringify({ email }),
    }),

  // Имэйл солих баталгаажуулалт — OTP зөв бол л email солигдоно
  confirmEmailChange: (token: string, otp: string) =>
    request<{ message: string }>('/auth/confirm-email-change', {
      method: 'POST',
      token,
      body: JSON.stringify({ otp }),
    }),

  resendOtp: (body: { email: string; purpose: 'verify' | 'reset' }) =>
    request<{ message: string }>('/auth/resend-otp', { method: 'POST', body: JSON.stringify(body) }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (body: { email: string; otp: string; newPassword: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// —— Orders ——
export const ordersApi = {
  list: (token: string, page = 1, pageSize = 20) =>
    request<{ items: Order[]; total: number; page: number; pageSize: number }>(
      `/orders${qs({ page, pageSize })}`,
      { token },
    ),

  one: (token: string, id: string) => request<Order>(`/orders/${id}`, { token }),

  cancel: (token: string, orderId: string) =>
    request<Order>(`/orders/${orderId}/cancel`, { method: 'PATCH', token }),

  create: (token: string, productIds: string[], couponCodes?: string[]) =>
    request<Order>('/orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ productIds, ...(couponCodes && couponCodes.length > 0 ? { couponCodes } : {}) }),
    }),
};

// —— Downloads ——
export const downloadsApi = {
  history: (token: string) => request<PurchasedProduct[]>('/downloads', { token }),

  signedUrl: (token: string, fileId: string) =>
    request<{ url: string; expiresIn: number; generatedAt: number }>(`/downloads/${fileId}`, {
      method: 'POST',
      token,
    }),

  zipUrl: (productId: string) => `/downloads/zip/${productId}`,
  bundleZipUrl: (productId: string, bundleId: string) => `/downloads/zip/${productId}/bundle/${bundleId}`,
  enqueueProductZip: (token: string, productId: string) =>
    request<{ jobId: string }>(`/downloads/async-zip/${productId}`, { method: 'POST', token }),
  enqueueBundleZip: (token: string, productId: string, bundleId: string) =>
    request<{ jobId: string }>(`/downloads/async-zip/${productId}/bundle/${bundleId}`, { method: 'POST', token }),
  pollZipJob: (token: string, jobId: string) =>
    request<{ status: string; url?: string; error?: string }>(`/downloads/async-zip/status/${jobId}`, { token }),

  productDownloadFile: (token: string, productId: string) =>
    request<{ url: string; fileName: string }>(`/downloads/product/${productId}/download-file`, { method: 'POST', token }),

  bundleDownloadFile: (token: string, bundleId: string) =>
    request<{ url: string; fileName: string }>(`/downloads/bundle/${bundleId}/download-file`, { method: 'POST', token }),

  // ── ҮНЭГҮЙ бүтээгдэхүүн (нэвтрэхгүй, token-гүй) ──
  freeFile: (productId: string, fileId: string) =>
    request<{ fileId: string; fileName: string; url: string; expiresIn: number }>(
      `/downloads/free/${productId}/file/${fileId}`,
      { method: 'POST' },
    ),
  freeProductDownloadFile: (productId: string) =>
    request<{ url: string; fileName: string }>(`/downloads/free/${productId}/download-file`, { method: 'POST' }),
  enqueueFreeZip: (productId: string) =>
    request<{ jobId: string }>(`/downloads/free/${productId}/zip`, { method: 'POST' }),
  pollFreeZipJob: (jobId: string) =>
    request<{ status: string; url?: string; error?: string }>(`/downloads/free/zip/status/${jobId}`),
};

// —— Browser-switch state transfer (FB/IG → системийн браузар) ——
export const transferApi = {
  // Сагс/wishlist/coupon/guest state-ийг түр хадгалж token авна
  save: (payload: unknown) =>
    request<{ token: string }>('/transfer', { method: 'POST', body: JSON.stringify({ payload }) }),
  // Token-оор state сэргээх (нэг удаагийн)
  consume: (token: string) =>
    request<{ payload: unknown }>(`/transfer/${token}`),
};

// —— Payments ——
export const paymentsApi = {
  initiateQPay: (token: string, orderId: string) =>
    request<PaymentInitiateResult>('/payments/qpay/initiate', {
      method: 'POST',
      token,
      body: JSON.stringify({ orderId }),
    }),

  checkQPay: (token: string, orderId: string) =>
    request<{ paid: boolean; orderId: string }>('/payments/qpay/check', {
      method: 'POST',
      token,
      body: JSON.stringify({ orderId }),
    }),
};

// —— Users ——
export const usersApi = {
  me: (token: string) => request<AuthUser>('/users/me', { token }),

  updateMe: (token: string, body: { name?: string; image?: string; phone?: string; email?: string }) =>
    request<AuthUser>('/users/me', {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

  updatePassword: (
    token: string,
    body: { email?: string; currentPassword?: string; newPassword: string },
  ) =>
    request<AuthUser>('/users/me/password', {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),
};

// —— Banners ——
export const bannersApi = {
  list: () => request<Banner[]>('/banners'),
};

// —— Menu ——
export const menuApi = {
  list: () => request<MenuItem[]>('/menu'),
};

// —— Testimonials ——
export const testimonialsApi = {
  listActive: () => request<Testimonial[]>('/testimonials'),
};

// —— Wishlist ——
export const wishlistApi = {
  list: (token: string) => request<WishlistItem[]>('/wishlist', { token }),
  toggle: (token: string, productId: string) =>
    request<{ added: boolean }>('/wishlist', {
      method: 'POST',
      token,
      body: JSON.stringify({ productId }),
    }),
  remove: (token: string, productId: string) =>
    request<void>(`/wishlist/${productId}`, { method: 'DELETE', token }),
};

// —— Blog ——
export const blogApi = {
  list: (params?: { page?: number; pageSize?: number; tag?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.tag) q.set('tag', params.tag);
    const queryStr = q.toString();
    return request<{ items: BlogPost[]; total: number; page: number; pageSize: number }>(`/blog${queryStr ? `?${queryStr}` : ''}`);
  },
  latest: (count = 3) => request<BlogPost[]>(`/blog/latest?count=${count}`),
  search: (q: string) => request<BlogPost[]>(`/blog/search?q=${encodeURIComponent(q)}`),
  bySlug: (slug: string) => request<BlogPost>(`/blog/${slug}`),
  incrementView: (slug: string) =>
    request<{ ok: boolean }>(`/blog/${slug}/view`, { method: 'POST' }).catch(() => null),
};

// —— Coupons ——
export const couponsApi = {
  validate: (
    code: string,
    price: number,
    options?: { token?: string; productIds?: string[] },
  ) =>
    request<{
      valid: boolean;
      code: string;
      type: string;
      value: number;
      discount: number;
      finalPrice: number;
      message?: string;
    }>('/coupons/validate', {
      method: 'POST',
      token: options?.token,
      body: JSON.stringify({
        code,
        price,
        ...(options?.productIds?.length ? { productIds: options.productIds } : {}),
      }),
    }),
};

// —— Courses ——
export interface LessonResource {
  id: string;
  fileName: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
}

export interface LessonVideoResult {
  lessonId: string;
  type: 'stream' | 'r2' | 'external';
  url?: string;
  streamToken?: string;
  hlsUrl?: string;
  iframeUrl?: string;
  expiresIn?: number | null;
  // ── Хичээлийн нэмэлт агуулга (backend шинэ) ──
  /** Rich HTML тэмдэглэл (sanitizeHtml-аар render) */
  content?: string | null;
  /** Татах материалын файлууд */
  resources?: LessonResource[];
}

export interface LessonProgress {
  lessonId: string;
  watchedSeconds: number;
  durationSec: number | null;
  completed: boolean;
}

export const coursesApi = {
  getLessonVideoUrl: (token: string, productSlug: string, lessonId: string) =>
    request<LessonVideoResult>(
      `/courses/${productSlug}/lessons/${lessonId}/video`,
      { token },
    ),

  saveProgress: (
    token: string,
    productSlug: string,
    lessonId: string,
    body: { watchedSeconds: number; durationSec?: number; completed?: boolean },
  ) =>
    request<void>(`/courses/${productSlug}/lessons/${lessonId}/progress`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  getProgress: (token: string, productSlug: string) =>
    request<LessonProgress[]>(`/courses/${productSlug}/progress`, { token }),

  // Хичээлийн татах материалын signed url
  getResourceDownload: (token: string, productSlug: string, resourceId: string) =>
    request<{ url: string; fileName: string }>(
      `/courses/${productSlug}/resources/${resourceId}/download`,
      { method: 'GET', token },
    ),
};

// —— Pages ——
export interface PageData {
  slug: string;
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  ogImageUrl?: string | null;
}

export const pagesApi = {
  bySlug: (slug: string) => request<PageData | null>(`/pages/${slug}`),
};

// —— Public Site Settings ——
export interface PublicSiteSettings {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  defaultTheme: 'light' | 'dark' | 'system';
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCardType: string | null;
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  fbPixelId: string | null;
}

export const siteSettingsApi = {
  getPublic: () => request<PublicSiteSettings>('/settings/public'),
};

// —— Subscribers (newsletter) ——
export const subscribersApi = {
  subscribe: (body: { email: string; source?: string }) =>
    request<{ ok: boolean }>('/subscribers/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// —— Contact (холбоо барих хүсэлт) ——
export const contactApi = {
  submit: (body: {
    name: string;
    email: string;
    phone?: string;
    message: string;
    captchaA: number;
    captchaB: number;
    captchaAnswer: number;
  }) =>
    request<{ ok: boolean }>('/contact', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ─── Navbar SSR prefetch ──────────────────────────────────────────────────
// Server дээр меню + public settings-ийг урьдчилан татаж navbar-ийн анхны HTML-д
// бодит утгаар суулгана → cache-гүй ачаалал дээр flash/үсрэлт ОГТ гарахгүй.
// ISR (revalidate 60с) — admin меню/лого шинэчилбэл 1 минутын дотор шинэчилнэ.
// API унавал null буцаана → navbar статик FALLBACK_MENU + статик лого ашиглана.
export type NavbarPrefetch = {
  menu: MenuItem[] | null;
  settings: PublicSiteSettings | null;
};

export async function getNavbarData(): Promise<NavbarPrefetch> {
  const apiBase =
    (typeof window === 'undefined' && process.env.INTERNAL_API_URL) ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000';

  async function safeGet<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${apiBase}/api${path}`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  const [menu, settings] = await Promise.all([
    safeGet<MenuItem[]>('/menu'),
    safeGet<PublicSiteSettings>('/settings/public'),
  ]);

  return { menu, settings };
}

export { ApiError };
