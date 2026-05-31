export const SITE_NAME = 'DigitalGer';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://digitalger.mn';

// NEXT_PUBLIC_ vars are baked at build time — usable in browser but wrong inside Docker.
// INTERNAL_API_URL is NOT baked (no prefix) → reads actual runtime env on the server.
export const API_URL =
  typeof window === 'undefined' && process.env.INTERNAL_API_URL
    ? process.env.INTERNAL_API_URL
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

// n8n web-chat webhook (AI туслах). Вэб chat widget энэ рүү fetch хийнэ.
export const CHAT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_CHAT_WEBHOOK_URL ?? 'https://bot.digitalger.mn/webhook/web-chat';


