export const SITE_NAME = 'DigitalGer Admin';

// ⚠️ Admin panel-д нэвтрэх боломжтой БҮХ дүр (multi-tenant). Энэ жагсаалтыг
// ОЛОН ГАЗАР хуулж бичихгүй — нэг эх сурвалжаас import хийнэ. Эс бол нэг газар
// засаад нөгөөг мартвал SUPERADMIN нэвтэрч чадахгүй болох гэх мэт алдаа гарна
// (өмнө тохиолдсон). Шинэ дүр нэмбэл ЗӨВХӨН ЭНД нэм.
export const ADMIN_ROLES = ['EDITOR', 'ADMIN', 'SUPERADMIN'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// NEXT_PUBLIC_ vars are baked at build time — usable in browser but wrong inside Docker.
// INTERNAL_API_URL is NOT baked (no prefix) → reads actual runtime env on the server.
export const API_URL =
  typeof window === 'undefined' && process.env.INTERNAL_API_URL
    ? process.env.INTERNAL_API_URL
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');
