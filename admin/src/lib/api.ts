import type { Paginated } from '@digitalger/shared';
import { API_URL } from './constants';
import type {
  AdminBanner,
  AdminBundle,
  AdminBundleItem,
  AdminCategory,
  AdminCoupon,
  AdminFaq,
  AdminLesson,
  AdminCourseModule,
  GrantedProduct,
  AdminMenuItem,
  AdminOrder,
  AdminPaymentRow,
  AdminProduct,
  AdminProductFile,
  AdminProductImage,
  AdminProductTypeConfig,
  AdminProfile,
  AdminSubscriber,
  AdminSubscriberCategory,
  AdminTestimonial,
  AdminUser,
  AdminUserDetail,
  AdminUserFullDetail,
  DashboardStats,
  QueueStatus,
  SiteSettings,
  ThemeSettings,
  UploadResult,
} from '@/types/admin';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAccessToken(): Promise<string | undefined> {
  if (typeof window === 'undefined') {
    const { cookies } = await import('next/headers');
    const { jwtVerify } = await import('jose');
    const { getAuthSecret } = await import('@/lib/secret');
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-session')?.value;
    if (!token) return undefined;
    try {
      const { payload } = await jwtVerify(token, getAuthSecret());
      return payload.accessToken as string;
    } catch { return undefined; }
  }
  const res = await fetch('/api/me');
  if (!res.ok) return undefined;
  const data = await res.json();
  return data.accessToken;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(body || res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  // 200 + хоосон body үед res.json() нь 'Unexpected end of JSON input' өгдөг.
  // Эхлээд текстээр уншаад хоосон бол undefined буцаана.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const adminApi = {
  dashboard: () => adminFetch<DashboardStats>('/admin/dashboard'),

  profile: {
    get: () => adminFetch<AdminProfile>('/users/me'),
    update: (body: { name?: string; image?: string; email?: string }) =>
      adminFetch<AdminProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    updatePassword: (body: { currentPassword: string; newPassword: string }) =>
      adminFetch<AdminProfile>('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    uploadAvatar: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return adminFetch<AdminProfile>('/users/me/avatar', {
        method: 'POST',
        body: form,
      });
    },
  },

  products: {
    list: (params?: { page?: number; pageSize?: number; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.pageSize) q.set('pageSize', String(params.pageSize));
      if (params?.search) q.set('search', params.search);
      const qs = q.toString();
      return adminFetch<Paginated<AdminProduct>>(
        `/admin/products${qs ? `?${qs}` : ''}`,
      );
    },
    get: (id: string) => adminFetch<AdminProduct>(`/admin/products/${id}`),
    create: (body: Record<string, unknown>) =>
      adminFetch<AdminProduct>('/admin/products', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Record<string, unknown>) =>
      adminFetch<AdminProduct>(`/admin/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      adminFetch<void>(`/admin/products/${id}`, { method: 'DELETE' }),
    clone: (id: string) =>
      adminFetch<AdminProduct>(`/admin/products/${id}/clone`, { method: 'POST' }),
    generate: (body: { fileNames: string[]; fileTypes: string[]; productType: string; categoryName?: string }) =>
      adminFetch<{ title: string; description: string; howToUse: string; whatsIncluded: string }>(
        '/admin/products/generate',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    aiStatus: () => adminFetch<{ enabled: boolean }>('/admin/ai/status'),
    bulkImport: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return adminFetch<{ total: number; created: number; failed: number; results: { row: number; status: string; title?: string; error?: string }[] }>(
        '/admin/products/bulk-import',
        { method: 'POST', body: fd },
      );
    },
    images: {
      list: (productId: string) => adminFetch<AdminProductImage[]>(`/admin/products/${productId}/images`),
      addVideo: (productId: string, videoUrl: string, alt?: string) =>
        adminFetch<AdminProductImage>(`/admin/products/${productId}/images`, {
          method: 'POST',
          body: JSON.stringify({ videoUrl, alt }),
        }),
      addImage: (
        productId: string,
        fileKey: string,
        alt?: string,
        isPrimary?: boolean,
        variants?: { size: string; fileKey: string; width: number; height: number; bytes: number }[],
      ) =>
        adminFetch<AdminProductImage>(`/admin/products/${productId}/images`, {
          method: 'POST',
          body: JSON.stringify({ fileKey, alt, isPrimary, variants }),
        }),
      update: (productId: string, imageId: string, body: { alt?: string; isPrimary?: boolean; sortOrder?: number }) =>
        adminFetch<AdminProductImage>(`/admin/products/${productId}/images/${imageId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
      remove: (productId: string, imageId: string) =>
        adminFetch<void>(`/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
      reorder: (productId: string, items: { id: string; sortOrder: number }[]) =>
        adminFetch<{ success: boolean }>(`/admin/products/${productId}/images/reorder`, {
          method: 'PUT',
          body: JSON.stringify({ items }),
        }),
    },
    files: {
      list: (productId: string) => adminFetch<AdminProductFile[]>(`/admin/products/${productId}/files`),
      add: (productId: string, body: { fileKey: string; fileName: string; mimeType?: string; sizeBytes?: number }) =>
        adminFetch<AdminProductFile>(`/admin/products/${productId}/files`, { method: 'POST', body: JSON.stringify(body) }),
      remove: (productId: string, fileId: string) =>
        adminFetch<void>(`/admin/products/${productId}/files/${fileId}`, { method: 'DELETE' }),
      setDownloadFile: (productId: string, downloadFileKey: string | null) =>
        adminFetch<{ id: string; downloadFileKey: string | null }>(`/admin/products/${productId}/download-file`, {
          method: 'PATCH',
          body: JSON.stringify({ downloadFileKey }),
        }),
    },
    modules: {
      list: (productId: string) => adminFetch<AdminCourseModule[]>(`/admin/products/${productId}/modules`),
      create: (productId: string, body: { title: string; sortOrder?: number }) =>
        adminFetch<AdminCourseModule>(`/admin/products/${productId}/modules`, { method: 'POST', body: JSON.stringify(body) }),
      update: (productId: string, moduleId: string, body: Partial<{ title: string; sortOrder: number }>) =>
        adminFetch<AdminCourseModule>(`/admin/products/${productId}/modules/${moduleId}`, { method: 'PATCH', body: JSON.stringify(body) }),
      remove: (productId: string, moduleId: string) =>
        adminFetch<void>(`/admin/products/${productId}/modules/${moduleId}`, { method: 'DELETE' }),
      reorder: (productId: string, items: { id: string; sortOrder: number }[]) =>
        adminFetch<{ success: boolean }>(`/admin/products/${productId}/modules/reorder`, { method: 'PUT', body: JSON.stringify({ items }) }),
    },
    lessons: {
      list: (productId: string) => adminFetch<AdminLesson[]>(`/admin/products/${productId}/lessons`),
      create: (productId: string, body: { title: string; description?: string; videoUrl?: string; videoKey?: string; durationSec?: number; isFreePreview?: boolean; sortOrder?: number; moduleId?: string }) =>
        adminFetch<AdminLesson>(`/admin/products/${productId}/lessons`, { method: 'POST', body: JSON.stringify(body) }),
      update: (productId: string, lessonId: string, body: Partial<{ title: string; description: string; videoUrl: string; videoKey: string; durationSec: number; isFreePreview: boolean; sortOrder: number; moduleId: string | null }>) =>
        adminFetch<AdminLesson>(`/admin/products/${productId}/lessons/${lessonId}`, { method: 'PATCH', body: JSON.stringify(body) }),
      remove: (productId: string, lessonId: string) =>
        adminFetch<void>(`/admin/products/${productId}/lessons/${lessonId}`, { method: 'DELETE' }),
      reorder: (productId: string, items: { id: string; sortOrder: number }[]) =>
        adminFetch<{ success: boolean }>(`/admin/products/${productId}/lessons/reorder`, { method: 'PUT', body: JSON.stringify({ items }) }),
    },
    getFaqIds: (productId: string) =>
      adminFetch<string[]>(`/admin/faqs/product/${productId}`),
    assignFaqs: (productId: string, faqIds: string[]) =>
      adminFetch<void>(`/admin/faqs/product/${productId}`, { method: 'POST', body: JSON.stringify({ faqIds }) }),
    getTestimonialIds: (productId: string) =>
      adminFetch<string[]>(`/admin/testimonials/product/${productId}`),
    assignTestimonials: (productId: string, testimonialIds: string[]) =>
      adminFetch<void>(`/admin/testimonials/product/${productId}`, { method: 'POST', body: JSON.stringify({ testimonialIds }) }),
  },

  categories: {
    list: () => adminFetch<AdminCategory[]>('/admin/categories'),
    create: (body: Record<string, unknown>) =>
      adminFetch<AdminCategory>('/admin/categories', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Record<string, unknown>) =>
      adminFetch<AdminCategory>(`/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      adminFetch<void>(`/admin/categories/${id}`, { method: 'DELETE' }),
  },

  orders: {
    list: (params?: { page?: number; pageSize?: number; status?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.pageSize) q.set('pageSize', String(params.pageSize));
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      if (params?.search) q.set('search', params.search);
      const qs = q.toString();
      return adminFetch<Paginated<AdminOrder>>(
        `/admin/orders${qs ? `?${qs}` : ''}`,
      );
    },
    get: (id: string) => adminFetch<AdminOrder>(`/admin/orders/${id}`),
    updateStatus: (id: string, status: string) =>
      adminFetch<AdminOrder>(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    update: (id: string, body: { status?: string; couponCode?: string | null }) =>
      adminFetch<AdminOrder>(`/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      adminFetch<{ success: boolean }>(`/admin/orders/${id}`, { method: 'DELETE' }),
    updatePayment: (id: string, status: string) =>
      adminFetch<{ id: string; status: string }>(`/admin/payments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    removePayment: (id: string) =>
      adminFetch<{ success: boolean }>(`/admin/payments/${id}`, { method: 'DELETE' }),
    listPayments: (params?: { page?: number; pageSize?: number; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.pageSize) q.set('pageSize', String(params.pageSize));
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      const qs = q.toString();
      return adminFetch<{ items: AdminPaymentRow[]; total: number; page: number; pageSize: number }>(
        `/admin/payments${qs ? `?${qs}` : ''}`,
      );
    },
  },

  users: {
    list: (params?: { page?: number; pageSize?: number; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.pageSize) q.set('pageSize', String(params.pageSize));
      if (params?.search) q.set('search', params.search);
      const qs = q.toString();
      return adminFetch<Paginated<AdminUser>>(
        `/admin/users${qs ? `?${qs}` : ''}`,
      );
    },
    get: (id: string) => adminFetch<AdminUserDetail>(`/admin/users/${id}`),
    // Хэрэглэгчийн ДЭЛГЭРЭНГҮЙ — popup-д бүх дата (захиалга/татсан/үзсэн/
    // дарсан/төхөөрөмж/аккаунт түүх) нэг дуудлагаар.
    detail: (id: string) => adminFetch<AdminUserFullDetail>(`/admin/users/${id}/detail`),
    update: (id: string, body: { name?: string; role?: string; phone?: string; email?: string }) =>
      adminFetch<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    // Админ хэрэглэгчийн нууц үгийг шууд тохируулна
    setPassword: (id: string, newPassword: string) =>
      adminFetch<{ success: boolean }>(`/admin/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      }),
    block: (id: string, blocked: boolean) =>
      adminFetch<AdminUser>(`/admin/users/${id}/block`, {
        method: 'PATCH',
        body: JSON.stringify({ blocked }),
      }),
    delete: (id: string) =>
      adminFetch<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
    // Бүтээгдэхүүн үнэгүй идэвхжүүлэх (admin grant)
    grantProducts: (id: string, productIds: string[]) =>
      adminFetch<{ granted: number; skipped: number; orderId?: string; message?: string }>(
        `/admin/users/${id}/grant-products`,
        { method: 'POST', body: JSON.stringify({ productIds }) },
      ),
    listGranted: (id: string) =>
      adminFetch<{ items: GrantedProduct[] }>(`/admin/users/${id}/granted-products`),
    revokeGranted: (id: string, productId: string) =>
      adminFetch<{ success: boolean }>(`/admin/users/${id}/granted-products/${productId}`, {
        method: 'DELETE',
      }),
  },

  settings: {
    get: () =>
      adminFetch<{ theme: ThemeSettings | null; site: SiteSettings | null }>(
        '/admin/settings',
      ),
    updateTheme: (body: Partial<ThemeSettings>) =>
      adminFetch<ThemeSettings>('/admin/settings/theme', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    updateSite: (body: Partial<SiteSettings>) =>
      adminFetch<SiteSettings>('/admin/settings/site', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },

  banners: {
    list: () => adminFetch<AdminBanner[]>('/admin/banners'),
    create: (body: Partial<AdminBanner>) =>
      adminFetch<AdminBanner>('/admin/banners', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminBanner>) =>
      adminFetch<AdminBanner>(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/banners/${id}`, { method: 'DELETE' }),
  },

  faqs: {
    list: () => adminFetch<AdminFaq[]>('/admin/faqs'),
    create: (body: { question: string; answer: string; category?: string; sortOrder?: number; active?: boolean }) =>
      adminFetch<AdminFaq>('/admin/faqs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminFaq>) =>
      adminFetch<AdminFaq>(`/admin/faqs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/faqs/${id}`, { method: 'DELETE' }),
    getProductIds: (faqId: string) => adminFetch<string[]>(`/admin/faqs/${faqId}/product-ids`),
  },

  testimonials: {
    list: () => adminFetch<AdminTestimonial[]>('/admin/testimonials'),
    create: (body: Partial<AdminTestimonial>) =>
      adminFetch<AdminTestimonial>('/admin/testimonials', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminTestimonial>) =>
      adminFetch<AdminTestimonial>(`/admin/testimonials/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/testimonials/${id}`, { method: 'DELETE' }),
  },

  bundles: {
    list: (productId: string) => adminFetch<AdminBundle[]>(`/admin/products/${productId}/bundles`),
    create: (productId: string, body: { title: string; description?: string; sortOrder?: number }) =>
      adminFetch<AdminBundle>(`/admin/products/${productId}/bundles`, { method: 'POST', body: JSON.stringify(body) }),
    update: (productId: string, bundleId: string, body: Partial<AdminBundle>) =>
      adminFetch<AdminBundle>(`/admin/products/${productId}/bundles/${bundleId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    setDownloadFile: (productId: string, bundleId: string, downloadFileKey: string | null) =>
      adminFetch<AdminBundle>(`/admin/products/${productId}/bundles/${bundleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ downloadFileKey }),
      }),
    remove: (productId: string, bundleId: string) =>
      adminFetch<void>(`/admin/products/${productId}/bundles/${bundleId}`, { method: 'DELETE' }),
    addItem: (productId: string, bundleId: string, body: { name: string; description?: string; sortOrder?: number }) =>
      adminFetch<AdminBundleItem>(`/admin/products/${productId}/bundles/${bundleId}/items`, { method: 'POST', body: JSON.stringify(body) }),
    updateItem: (productId: string, bundleId: string, itemId: string, body: Partial<AdminBundleItem>) =>
      adminFetch<AdminBundleItem>(`/admin/products/${productId}/bundles/${bundleId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    removeItem: (productId: string, bundleId: string, itemId: string) =>
      adminFetch<void>(`/admin/products/${productId}/bundles/${bundleId}/items/${itemId}`, { method: 'DELETE' }),
  },

  files: {
    byIds: (ids: string[]) =>
      adminFetch<AdminProductFile[]>('/admin/files/by-ids', { method: 'POST', body: JSON.stringify({ ids }) }),
  },

  menu: {
    list: () => adminFetch<AdminMenuItem[]>('/admin/menu'),
    create: (body: Partial<AdminMenuItem>) =>
      adminFetch<AdminMenuItem>('/admin/menu', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminMenuItem>) =>
      adminFetch<AdminMenuItem>(`/admin/menu/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/menu/${id}`, { method: 'DELETE' }),
    reorder: (ids: string[]) =>
      adminFetch<AdminMenuItem[]>('/admin/menu/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
  },

  pages: {
    get: (slug: string) =>
      adminFetch<{
        slug: string;
        title: string;
        content: string;
        metaTitle?: string | null;
        metaDescription?: string | null;
        metaKeywords?: string | null;
        ogImageUrl?: string | null;
      } | null>(`/pages/${slug}`).catch(() => null),
    update: (
      slug: string,
      body: {
        title: string;
        content: string;
        metaTitle?: string;
        metaDescription?: string;
        metaKeywords?: string;
        ogImageUrl?: string;
      },
    ) => adminFetch<any>(`/admin/pages/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
  },

  blog: {
    list: () => adminFetch<any[]>('/admin/blog'),
    create: (body: any) => adminFetch<any>('/admin/blog', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => adminFetch<any>(`/admin/blog/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/blog/${id}`, { method: 'DELETE' }),
  },

  coupons: {
    list: () => adminFetch<AdminCoupon[]>('/admin/coupons'),
    generateCode: () => adminFetch<{ code: string }>('/admin/coupons/generate-code'),
    create: (body: {
      code?: string;
      type: 'PERCENT' | 'FIXED';
      value: number;
      minPrice?: number;
      maxUses?: number;
      active?: boolean;
      expiresAt?: string | null;
    }) => adminFetch<AdminCoupon>('/admin/coupons', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{
      code: string;
      type: 'PERCENT' | 'FIXED';
      value: number;
      minPrice: number | null;
      maxUses: number | null;
      active: boolean;
      expiresAt: string | null;
    }>) => adminFetch<AdminCoupon>(`/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/coupons/${id}`, { method: 'DELETE' }),
  },

  productTypes: {
    list: () => adminFetch<AdminProductTypeConfig[]>('/admin/product-types'),
    create: (body: { value: string; label: string; description?: string; icon?: string; sortOrder?: number; active?: boolean }) =>
      adminFetch<AdminProductTypeConfig>('/admin/product-types', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Omit<AdminProductTypeConfig, 'id' | 'createdAt' | 'updatedAt'>>) =>
      adminFetch<AdminProductTypeConfig>(`/admin/product-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => adminFetch<void>(`/admin/product-types/${id}`, { method: 'DELETE' }),
  },

  queue: {
    status: () => adminFetch<QueueStatus>('/admin/queue/status'),
    retryFailed: () => adminFetch<{ retried: number }>('/admin/queue/retry-failed', { method: 'POST' }),
    clean: () => adminFetch<{ success: boolean }>('/admin/queue/clean', { method: 'DELETE' }),
  },

  upload: (
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResult> => {
    return new Promise(async (resolve, reject) => {
      const token = await getAccessToken();
      const form = new FormData();
      form.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/uploads`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new ApiError('Invalid response', xhr.status)); }
        } else {
          reject(new ApiError(xhr.responseText || xhr.statusText, xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('Network error', 0));
      xhr.ontimeout = () => reject(new ApiError('Timeout', 0));

      xhr.send(form);
    });
  },

  /** Том файлд (>100MB) presigned URL авч browser→R2 шууд upload хийнэ */
  presignUpload: (body: { fileName: string; contentType: string; folder?: string }) =>
    adminFetch<{ uploadUrl: string; key: string; publicUrl: string }>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getAnalyticsDashboard: (days = 30) =>
    adminFetch<{
      overview: { totalViews: number; todayViews: number; yesterdayViews: number; growthPercent: number | null };
      dailyViews: { date: string; count: number }[];
      topPages: { path: string; count: number }[];
      topProducts: { slug: string; productId: string; views: number }[];
      topSearches: { query: string; count: number }[];
      deviceStats: { device: string; count: number }[];
      funnel: { view: number; click: number; cart: number; purchase: number };
    }>(`/analytics/dashboard?days=${days}`),

  subscribers: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      categoryId?: string;
      source?: string;
      sex?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.pageSize) q.set('pageSize', String(params.pageSize));
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.categoryId) q.set('categoryId', params.categoryId);
      if (params?.source) q.set('source', params.source);
      if (params?.sex) q.set('sex', params.sex);
      const qs = q.toString();
      return adminFetch<Paginated<AdminSubscriber>>(`/admin/subscribers${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => adminFetch<AdminSubscriber>(`/admin/subscribers/${id}`),
    create: (body: Partial<AdminSubscriber>) =>
      adminFetch<AdminSubscriber>('/admin/subscribers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminSubscriber>) =>
      adminFetch<AdminSubscriber>(`/admin/subscribers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) =>
      adminFetch<void>(`/admin/subscribers/${id}`, { method: 'DELETE' }),
    assignCategory: (subscriberIds: string[], categoryId: string | null) =>
      adminFetch<{ updated: number }>('/admin/subscribers/assign-category', {
        method: 'POST',
        body: JSON.stringify({ subscriberIds, categoryId }),
      }),
    bulkDelete: (subscriberIds: string[]) =>
      adminFetch<{ deleted: number }>('/admin/subscribers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ subscriberIds }),
      }),
    bulkImport: (file: File, categoryId?: string) => {
      const fd = new FormData();
      fd.append('file', file);
      if (categoryId) fd.append('categoryId', categoryId);
      return adminFetch<{ total: number; created: number; skipped: number; failed: number; results: { row: number; status: string; email?: string; error?: string }[] }>(
        '/admin/subscribers/bulk-import',
        { method: 'POST', body: fd },
      );
    },
    // Export нь файл (excel) эсвэл хэвлэх HTML (pdf) буцаадаг тул URL-ийг шинэ tab-д нээнэ (доорх page-д)
    exportUrl: (params?: { format?: 'excel' | 'pdf'; status?: string; categoryId?: string; source?: string }) => {
      const q = new URLSearchParams();
      if (params?.format) q.set('format', params.format);
      if (params?.status) q.set('status', params.status);
      if (params?.categoryId) q.set('categoryId', params.categoryId);
      if (params?.source) q.set('source', params.source);
      const qs = q.toString();
      return `${API_URL}/api/admin/subscribers/export${qs ? `?${qs}` : ''}`;
    },
    categories: {
      list: () => adminFetch<AdminSubscriberCategory[]>('/admin/subscribers/categories'),
      create: (body: { name: string; description?: string }) =>
        adminFetch<AdminSubscriberCategory>('/admin/subscribers/categories', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: string, body: { name?: string; description?: string }) =>
        adminFetch<AdminSubscriberCategory>(`/admin/subscribers/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      remove: (id: string) =>
        adminFetch<void>(`/admin/subscribers/categories/${id}`, { method: 'DELETE' }),
    },
  },
};
