export const SITE_NAME = 'DigitalGer Admin';

// NEXT_PUBLIC_ vars are baked at build time — usable in browser but wrong inside Docker.
// INTERNAL_API_URL is NOT baked (no prefix) → reads actual runtime env on the server.
export const API_URL =
  typeof window === 'undefined' && process.env.INTERNAL_API_URL
    ? process.env.INTERNAL_API_URL
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
