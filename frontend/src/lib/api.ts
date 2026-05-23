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
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
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
    request<AuthTokens>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

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
export const coursesApi = {
  getLessonVideoUrl: (token: string, productSlug: string, lessonId: string) =>
    request<{ lessonId: string; url: string; expiresIn: number | null }>(
      `/courses/${productSlug}/lessons/${lessonId}/video`,
      { token },
    ),
};

// —— Pages ——
export const pagesApi = {
  bySlug: (slug: string) => request<{ slug: string; title: string; content: string } | null>(`/pages/${slug}`),
};

export { ApiError };
