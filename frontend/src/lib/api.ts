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

/**
 * ⚠️ AbortSignal.timeout() нь iOS Safari 16+, хуучин Android-д БАЙХГҮЙ.
 * iPhone 7 (iOS 15.x) дээр энэ нь `is not a function` алдаа өгч БҮХ API
 * хүсэлтийг шууд унагаадаг байсан (Миний сан/захиалга/Google нэвтрэлт бүгд
 * "Ачаалж чадсангүй"). Тиймээс байгаа бол ашиглана, эс бол AbortController +
 * setTimeout-аар найдвартай polyfill хийнэ (бүх браузерт ажиллана).
 */
function timeoutSignal(ms: number): AbortSignal {
  const AS = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof AS.timeout === 'function') return AS.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, signal, ...rest } = options;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    // signal дамжуулаагүй бол default 15сек timeout — API удаан/унавал
    // хязгааргүй хүлээж UI гацахаас сэргийлнэ (iOS15-д polyfill ашиглана)
    signal: signal ?? timeoutSignal(15000),
    // ⚠️ Next 15: тохиргоогүй fetch default no-store. ISR static хуудсанд
    // (revalidate export-той) no-store fetch route-ийг dynamic болгож болзошгүй.
    // `next: { revalidate }` дамжуулсан үед тухайн fetch-ийг cache-лэх боломжтой
    // болж page нь жинхэнэ static ISR хэвээр үлдэнэ (доорх `next` дамжуулалт).
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

// Presigned R2 URL руу файлыг PUT хийнэ (progress дэмждэг — XHR).
function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(`Upload амжилтгүй (${xhr.status})`, xhr.status));
    xhr.onerror = () => reject(new ApiError('Сүлжээний алдаа', 0));
    xhr.send(file);
  });
}

// Multipart (proxy) upload — backend /courses/questions/attachment руу файл илгээнэ.
function uploadQnaMultipart(
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<QnaAttachment> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/courses/questions/attachment`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as Partial<QnaAttachment> & {
            key?: string;
            fileName?: string;
            mimeType?: string;
            size?: number;
            url?: string;
          };
          // Backend ямар нэрээр буцаасныг (attachment* эсвэл upload-style key/url) нийцүүлнэ.
          resolve({
            attachmentKey: data.attachmentKey ?? data.key ?? '',
            attachmentName: data.attachmentName ?? data.fileName ?? file.name,
            attachmentMimeType:
              data.attachmentMimeType ?? data.mimeType ?? file.type ?? 'application/octet-stream',
            attachmentSize: data.attachmentSize ?? data.size ?? file.size,
            attachmentUrl: data.attachmentUrl ?? data.url,
          });
        } catch {
          reject(new ApiError('Хариу боловсруулж чадсангүй', xhr.status));
        }
      } else {
        reject(new ApiError(xhr.responseText || `Upload амжилтгүй (${xhr.status})`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError('Сүлжээний алдаа', 0));
    xhr.send(form);
  });
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
  // ⚠️ token (optional) — ADMIN нэвтэрсэн үед дамжуулбал backend optional auth-аар
  // adminOnly (зөвхөн админд) бүтээгдэхүүнийг ч буцаана. Token-гүй бол public (нуугдсан).
  list: (
    params?: {
      page?: number;
      pageSize?: number;
      category?: string;
      featured?: boolean;
      type?: string;
      types?: string;
      sortBy?: 'newest' | 'discount' | 'rating' | 'downloads';
      onSale?: boolean;
      minPrice?: number;
      maxPrice?: number;
    },
    token?: string,
  ) => {
    const query = qs({
      page: params?.page,
      pageSize: params?.pageSize,
      category: params?.category,
      featured: params?.featured,
      sortBy: params?.sortBy,
      onSale: params?.onSale,
      minPrice: params?.minPrice,
      maxPrice: params?.maxPrice,
      ...(params?.types ? { types: params.types } : { type: params?.type }),
    });
    // Public (token-гүй) жагсаалтыг ISR хуудсанд cache-лэх (home/section/static params).
    return request<PaginatedProducts>(`/products${query}`, {
      token,
      ...(token ? {} : { next: { revalidate: 60 } }),
    });
  },

  // token (optional) — ADMIN/SUPERADMIN/EDITOR бол хайлтад adminOnly бүтээгдэхүүн
  // (SUPERADMIN бүгд, ADMIN/EDITOR зөвхөн өөрийн) багтана. Token-гүй бол public.
  search: (q: string, page = 1, pageSize = 12, token?: string) =>
    request<PaginatedProducts>(
      `/products/search${qs({ q, page, pageSize })}`,
      { token },
    ),

  // token (optional) — ADMIN бол adminOnly бүтээгдэхүүний detail-ийг харна.
  // token-гүй (public) дуудалтыг ISR static хуудсанд cache-лэхийн тулд revalidate
  // тавина (token-той админ preview-д cache хийхгүй — шинэ дата харагдана).
  bySlug: (slug: string, token?: string) =>
    request<ProductDetail>(`/products/${slug}`, {
      token,
      ...(token ? {} : { next: { revalidate: 300 } }),
    }),
  incrementView: (slug: string) =>
    request<{ ok: boolean }>(`/products/${slug}/view`, { method: 'POST' }).catch(() => null),
  suggested: (slug: string, count = 4, token?: string) =>
    request<ProductSummary[]>(`/products/${slug}/suggested?count=${count}`, {
      token,
      ...(token ? {} : { next: { revalidate: 300 } }),
    }),

  // "Танд санал болгох" (personalized). token (optional) → нэвтэрсэн бол userId-аар
  // (view+худалдан авалт). viewedIds (optional) → зочны localStorage-ийн саяхан үзсэн
  // productId-ууд (category/type тогтооход). 2-уулаа байж болно (нэвтэрсэн + viewedIds).
  recommended: (token?: string, viewedIds?: string[], limit = 8) =>
    request<ProductSummary[]>(
      `/products/recommended${qs({
        viewedIds: viewedIds && viewedIds.length ? viewedIds.join(',') : undefined,
        limit,
      })}`,
      { token },
    ),
};

// —— Categories ——
export const categoriesApi = {
  list: () => request<Category[]>('/categories', { next: { revalidate: 300 } }),
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

  // Утас баталгаажуулах хүсэлт — verify.mn MO SMS. Хэрэглэгч буцаасан кодыг
  // 144773 руу SMS-ээр ИЛГЭЭНЭ (имэйл OTP-аас ТЭС ӨӨР flow).
  requestPhoneVerify: (token: string, phone: string) =>
    request<{
      sessionId: string;
      code: string;
      shortcode: string;
      smsUri: string;
      displayInstruction: string;
      expiresAt: string;
    }>('/auth/request-phone-verify', {
      method: 'POST',
      token,
      body: JSON.stringify({ phone }),
    }),

  // Утас verify статус (polling-аар шалгана — ≥3с зайтай, verify.mn 429 хязгаар)
  phoneVerifyStatus: (token: string, sessionId: string) =>
    request<{ status: 'pending' | 'verified' | 'expired' }>(
      `/auth/phone-verify/status?sessionId=${encodeURIComponent(sessionId)}`,
      { token },
    ),

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
  list: () => request<Banner[]>('/banners', { next: { revalidate: 60 } }),
};

// —— Menu ——
export const menuApi = {
  list: () => request<MenuItem[]>('/menu'),
};

// —— Testimonials ——
export const testimonialsApi = {
  listActive: () => request<Testimonial[]>('/testimonials', { next: { revalidate: 300 } }),
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
    return request<{ items: BlogPost[]; total: number; page: number; pageSize: number }>(
      `/blog${queryStr ? `?${queryStr}` : ''}`,
      { next: { revalidate: 600 } },
    );
  },
  latest: (count = 3) => request<BlogPost[]>(`/blog/latest?count=${count}`, { next: { revalidate: 300 } }),
  search: (q: string) => request<BlogPost[]>(`/blog/search?q=${encodeURIComponent(q)}`),
  bySlug: (slug: string) => request<BlogPost>(`/blog/${slug}`, { next: { revalidate: 600 } }),
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
  type: 'stream' | 'r2' | 'external' | 'none';
  url?: string;
  streamToken?: string;
  hlsUrl?: string;
  iframeUrl?: string;
  expiresIn?: number | null;
  /** Видео плэйерийн poster (thumbnail) — backend resolve хийж буцаана */
  posterUrl?: string | null;
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

// ── Сертификат ──
export interface CourseCertificate {
  certNo: string;
  courseTitle: string;
  userName: string;
  issuedAt: string;
}

// Хэрэглэгчийн авсан БҮХ сертификатын жагсаалтын мөр
// (нэг хэрэглэгч олон курс → олон сертификат)
export interface MyCertificate {
  certNo: string;
  courseTitle: string;
  userName: string;
  issuedAt: string;
  productSlug: string;
  productTitle: string;
  productThumbnail?: string | null;
  viewUrl: string;
}

// ── Q&A (асуулт-хариулт) ──
export interface QuestionUser {
  id?: string;
  name?: string | null;
  image?: string | null;
}

// Q&A асуулт/хариултад хавсаргасан файл (зураг/баримт). Backend R2-д хадгална.
export interface QnaAttachment {
  // R2 дахь объектын key (татах/resolve хийхэд)
  attachmentKey: string;
  // Файлын анхны нэр (UI-д харуулах)
  attachmentName: string;
  // MIME төрөл (зураг эсэхийг ялгахад: image/* бол thumbnail)
  attachmentMimeType: string;
  // Байт хэмжээ
  attachmentSize: number;
  // Шууд харах/татах нийтийн URL (backend буцаавал)
  attachmentUrl?: string;
}

export interface LessonAnswer {
  id?: string;
  answer: string;
  user: QuestionUser;
  isInstructor: boolean;
  createdAt: string;
  attachment?: QnaAttachment | null;
}

export interface LessonQuestion {
  id: string;
  question: string;
  user: QuestionUser;
  createdAt: string;
  isPinned?: boolean;
  answers: LessonAnswer[];
  attachment?: QnaAttachment | null;
}

// Q&A файл хавсаргахад зөвшөөрөгдөх төрөл/хэмжээ (frontend урьдчилсан шалгалт)
export const QNA_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const QNA_ALLOWED_MIME_PREFIXES = ['image/'];
export const QNA_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

export function isQnaMimeAllowed(mime: string): boolean {
  if (QNA_ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
  return QNA_ALLOWED_MIME_TYPES.has(mime);
}

// ── Шалгалт (quiz) ──
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface LessonQuiz {
  id: string;
  title: string;
  passScore: number;
  questions: QuizQuestion[];
  // Хэрэглэгчийн өмнөх хамгийн сайн оролдлого (badge-д ашиглана) — байхгүй бол null.
  bestAttempt?: { score: number; passed: boolean; createdAt: string } | null;
}

export interface QuizSubmitResult {
  score: number;
  passed: boolean;
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

  // ── Сертификат (курс 100% дуусахад) ──
  certificate: {
    // Одоо байгаа сертификат татах (байхгүй бол null)
    get: (token: string, productSlug: string) =>
      request<CourseCertificate | null>(`/courses/${productSlug}/certificate`, { token }).catch(() => null),
    // Сертификат шинээр гаргах (курс 100% дуусчихсан байх ёстой)
    issue: (token: string, productSlug: string) =>
      request<CourseCertificate>(`/courses/${productSlug}/certificate`, { method: 'POST', token }),
    // Public HTML сертификат харах URL (шинэ tab-д нээж хэвлэх/PDF)
    viewUrl: (certNo: string) => `${API_URL}/api/courses/certificate/${certNo}/view`,
    // Хэрэглэгчийн авсан БҮХ сертификат (dashboard "Миний сертификат")
    listMine: (token: string) =>
      request<MyCertificate[]>(`/courses/my/certificates`, { token }),
  },

  // ── Асуулт-хариулт (Q&A) ──
  questions: {
    list: (token: string, productSlug: string, lessonId: string) =>
      request<LessonQuestion[]>(
        `/courses/${productSlug}/lessons/${lessonId}/questions`,
        { token },
      ),
    ask: (
      token: string,
      productSlug: string,
      lessonId: string,
      question: string,
      attachment?: QnaAttachment | null,
    ) =>
      request<LessonQuestion>(`/courses/${productSlug}/lessons/${lessonId}/questions`, {
        method: 'POST',
        token,
        body: JSON.stringify(attachment ? { question, attachment } : { question }),
      }),
    answer: (
      token: string,
      questionId: string,
      answer: string,
      attachment?: QnaAttachment | null,
    ) =>
      request<LessonAnswer>(`/courses/questions/${questionId}/answers`, {
        method: 'POST',
        token,
        body: JSON.stringify(attachment ? { answer, attachment } : { answer }),
      }),

    // Q&A-д хавсаргах файлыг R2-д upload хийнэ.
    // Backend presigned PUT URL өгвөл browser шууд R2 руу хуулна (том файлд тохиромжтой),
    // үгүй бол /courses/questions/attachment руу multipart proxy upload хийнэ.
    // Backend хараахан бэлэн биш бол алдаа шиднэ — дуудагч талд graceful барина.
    uploadAttachment: async (
      token: string,
      file: File,
      onProgress?: (percent: number) => void,
    ): Promise<QnaAttachment> => {
      // 1) Presign оролдоно (том файл — шууд R2)
      try {
        const presign = await request<{ uploadUrl: string; key: string; publicUrl: string }>(
          `/courses/questions/attachment/presign`,
          {
            method: 'POST',
            token,
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type || 'application/octet-stream',
            }),
          },
        );
        await putToPresignedUrl(presign.uploadUrl, file, onProgress);
        return {
          attachmentKey: presign.key,
          attachmentName: file.name,
          attachmentMimeType: file.type || 'application/octet-stream',
          attachmentSize: file.size,
          attachmentUrl: presign.publicUrl,
        };
      } catch (err) {
        // presign endpoint байхгүй (404) бол multipart proxy руу шилжинэ.
        // Бусад алдаа (хэмжээ/эрх) бол дамжуулна.
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
      }

      // 2) Multipart proxy upload (жижиг файл / presign байхгүй)
      const result = await uploadQnaMultipart(token, file, onProgress);
      return result;
    },
  },

  // ── Шалгалт (quiz) ──
  quiz: {
    // Хичээлийн шалгалт (байхгүй бол null) — correctIndex backend-ээс ирэхгүй
    get: (token: string, productSlug: string, lessonId: string) =>
      request<LessonQuiz | null>(
        `/courses/${productSlug}/lessons/${lessonId}/quiz`,
        { token },
      ).catch(() => null),
    submit: (token: string, productSlug: string, lessonId: string, answers: number[]) =>
      request<QuizSubmitResult>(`/courses/${productSlug}/lessons/${lessonId}/quiz/submit`, {
        method: 'POST',
        token,
        body: JSON.stringify({ answers }),
      }),
  },
};

// —— Notifications (in-app, navbar 🔔) ——
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  // info | order | lesson | coupon | certificate
  type: string;
  // Дарахад очих route (байхгүй бол null)
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  // Сүүлийн N мэдэгдэл (dropdown)
  list: (token: string, limit = 10) =>
    request<NotificationItem[]>(`/notifications${qs({ limit })}`, { token }),

  // Уншаагүй тоо (badge) — polling-д ашиглана
  unreadCount: (token: string) =>
    request<{ count: number }>('/notifications/unread-count', { token }),

  // Нэг уншсан болгох
  markRead: (token: string, id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST', token }),

  // Бүгдийг уншсан болгох
  markAllRead: (token: string) =>
    request<{ ok: boolean; count: number }>('/notifications/read-all', { method: 'POST', token }),
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
  bySlug: (slug: string) => request<PageData | null>(`/pages/${slug}`, { next: { revalidate: 300 } }),
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
  getPublic: () => request<PublicSiteSettings>('/settings/public', { next: { revalidate: 300 } }),
};

// —— SEO override (тогтмол хуудсуудын custom OG meta) ——
export type SeoOverride = {
  title?: string | null;
  description?: string | null;
  ogImageUrl?: string | null;
};

export const seoApi = {
  /**
   * GET /seo/override?path=/products — public.
   * Override байвал {title?,description?,ogImageUrl?}, байхгүй бол null.
   */
  getOverride: (path: string) =>
    request<SeoOverride | null>(`/seo/override${qs({ path })}`, { next: { revalidate: 300 } }),
};

// —— Subscribers (newsletter) ——
export const subscribersApi = {
  subscribe: (body: { email: string; source?: string }) =>
    request<{ success: boolean; alreadySubscribed?: boolean }>('/subscribers/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// —— Chat (AI туслах) ——
export const chatApi = {
  // Зочны chat session-ийг нэвтэрсэн хэрэглэгчид холбох (backfill).
  // Backend POST /api/chat/link-session { sessionId } (JwtAuthGuard).
  // sessionId хэвээр үлдэнэ — зөвхөн userId-г backend дээр холбоно (яриа алдагдахгүй).
  linkSession: (token: string, sessionId: string) =>
    request<{ ok: boolean } | void>('/chat/link-session', {
      method: 'POST',
      token,
      body: JSON.stringify({ sessionId }),
    }),

  // Polling — чат нээлттэй үед шинэ мессеж (admin гар хариу) татах.
  // after = сүүлийн мессежийн ISO цаг (зөвхөн шинийг авна). handedOff төлөв ирнэ.
  getMessages: (sessionId: string, after?: string) =>
    request<{
      handedOff: boolean;
      messages: { id: string; role: string; text: string; products?: unknown; createdAt: string }[];
    }>(`/chat/messages?sessionId=${encodeURIComponent(sessionId)}${after ? `&after=${encodeURIComponent(after)}` : ''}`),

  // Floating badge — хэдэн уншаагүй admin мессеж (chat хаалттай үед polling).
  getUnread: (sessionId: string) =>
    request<{ unread: number; handedOff: boolean }>(
      `/chat/unread?sessionId=${encodeURIComponent(sessionId)}`,
    ),

  // Handoff үед хэрэглэгчийн мессежийг backend-д хадгалах (n8n руу явахгүй,
  // admin polling-оор харна). role='user'.
  saveMessage: (sessionId: string, role: 'user', text: string) =>
    request<{ ok: boolean }>('/chat/save', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, text, channel: 'web' }),
    }),
};

// —— Reviews (бүтээгдэхүүний сэтгэгдэл/үнэлгээ) ——
export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt?: string;
  user: { id: string; name: string | null; image: string | null };
}

export interface ReviewBreakdown {
  // { '5': 10, '4': 3, ... } — од бүрийн тоо
  [stars: string]: number;
}

export interface ReviewsPage {
  items: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  breakdown?: ReviewBreakdown;
}

export const reviewsApi = {
  // Жагсаалт (pagination, breakdown) — public
  list: (slug: string, page = 1, pageSize = 10) =>
    request<ReviewsPage>(`/reviews/${slug}${qs({ page, pageSize })}`),

  // Шинээр үлдээх (JwtAuthGuard + math captcha)
  create: (
    token: string,
    slug: string,
    body: {
      rating: number;
      comment: string;
      authorName?: string;
      captchaA: number;
      captchaB: number;
      captchaAnswer: number;
    },
  ) =>
    request<ReviewItem>(`/reviews/${slug}`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  // Өөрийн сэтгэгдэл засах
  update: (token: string, reviewId: string, body: { rating: number; comment: string }) =>
    request<ReviewItem>(`/reviews/${reviewId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(body),
    }),

  // Өөрийн сэтгэгдэл устгах
  remove: (token: string, reviewId: string) =>
    request<void>(`/reviews/${reviewId}`, { method: 'DELETE', token }),

  // Тухайн product дээрх ӨӨРИЙН сэтгэгдэл (байхгүй бол null)
  mine: (token: string, slug: string) =>
    request<ReviewItem | null>(`/reviews/${slug}/mine`, { token }).catch(() => null),
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
        signal: timeoutSignal(2500),
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
