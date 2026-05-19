export type UserRole = 'ADMIN' | 'USER';

export type ProductType =
  | 'FILE'
  | 'TEMPLATE'
  | 'DOCUMENT'
  | 'VIDEO'
  | 'COURSE'
  | 'HYBRID';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
