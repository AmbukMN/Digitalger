export const SITE_NAME = 'DigitalGer';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://digitalger.mn';

// NEXT_PUBLIC_ vars are baked at build time — usable in browser but wrong inside Docker.
// INTERNAL_API_URL is NOT baked (no prefix) → reads actual runtime env on the server.
export const API_URL =
  typeof window === 'undefined' && process.env.INTERNAL_API_URL
    ? process.env.INTERNAL_API_URL
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

export const NAV_LINKS = [
  { href: '/', label: 'Нүүр' },
  { href: '/products?type=FILE', label: 'Файлууд' },
  { href: '/products?type=TEMPLATE', label: 'Загварууд' },
  { href: '/products?type=COURSE', label: 'Курсууд' },
  { href: '/categories', label: 'Ангилал' },
] as const;

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FILE: 'Файл',
  TEMPLATE: 'Загвар',
  DOCUMENT: 'Баримт',
  VIDEO: 'Видео',
  COURSE: 'Курс',
  HYBRID: 'Хосолсон',
};
