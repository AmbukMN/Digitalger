'use client';

import type { ReactNode } from 'react';

/**
 * ЧАТЫН ТЕКСТ ДОТОРХ ХОЛБООС/ИМЭЙЛИЙГ ДАРЖ БОЛОХООР БОЛГОНО.
 *
 * ⚠️⚠️ ЯАГААД SHARED ПАКЕТАД БАЙНА ВЭ:
 * Өмнө нь вэб чат болон админ панельд ХОЁР ХУУЛБАР байсан —
 * нэгийг нь зассан алдаа нөгөөд үлдэх эрсдэлтэй байв.
 *
 * ⚠️ `dangerouslySetInnerHTML` ХЭРЭГЛЭХГҮЙ — React node массив
 * буцаана (XSS боломжгүй).
 *
 * ТАНИХ ХЭЛБЭРҮҮД (бодит чатнаас цуглуулсан):
 *   https://besttv.us/          — бүтэн
 *   http://besttv.us            — http
 *   www.besttv.us               — www-тэй, схемгүй
 *   besttv.us                   — зөвхөн домэйн
 *   besttv.us/pricing           — замтай
 *   support@besttv.mn           — имэйл
 */

/**
 * ⚠️ Схемгүй домэйныг таних ЦАГААН ЖАГСААЛТ.
 *
 * Дурын `үг.үг` хэлбэрийг холбоос гэж үзвэл энгийн өгүүлбэр
 * («кино.Дараа нь») эвдэрнэ. Тиймээс өөрийн домэйнуудыг л таана.
 */
const BARE_DOMAINS = ['besttv\\.us', 'besttv\\.mn', 'digitalger\\.mn'];

const PATTERN = new RegExp(
  [
    /* 1. Схемтэй бүтэн URL */
    'https?://[^\\s<>"]+',
    /* 2. www. эхэлсэн (схемгүй) */
    'www\\.[^\\s<>"]+',
    /* 3. Өөрийн домэйн ганцаараа эсвэл замтай */
    `(?:${BARE_DOMAINS.join('|')})(?:/[^\\s<>"]*)?`,
    /* 4. Имэйл */
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
  ].join('|'),
  'gi',
);

/** Өгүүлбэрийн төгсгөлийн цэг/хаалтыг холбоосоос хасна */
const TRAIL = /[.,;:!?)\]}»"']+$/;

export function renderRichText(text: string): ReactNode[] {
  const src = String(text ?? '');
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  /* ⚠️ `lastIndex` тэглэнэ — global regex модуль хэмжээнд дахин ашиглагдана */
  PATTERN.lastIndex = 0;

  while ((m = PATTERN.exec(src)) !== null) {
    if (m.index > last) parts.push(src.slice(last, m.index));

    const token = m[0];
    const trail = token.match(TRAIL);
    const clean = trail ? token.slice(0, token.length - trail[0].length) : token;

    const isEmail = clean.includes('@') && !clean.startsWith('http');
    /* Схемгүй бол https:// нэмнэ — эс бөгөөс browser харьцангуй зам гэж үзнэ */
    const href = isEmail
      ? `mailto:${clean}`
      : /^https?:\/\//i.test(clean)
        ? clean
        : `https://${clean}`;

    parts.push(
      <a
        key={`${m.index}-${clean}`}
        href={href}
        {...(isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        /* ⚠️ Мессеж дээр дарах үйлдэлтэй зөрчихгүй */
        onClick={(e) => e.stopPropagation()}
        className="text-primary underline underline-offset-2 hover:brightness-110"
      >
        {clean}
      </a>,
    );

    if (trail) parts.push(trail[0]);
    last = m.index + token.length;
  }

  if (last < src.length) parts.push(src.slice(last));
  return parts;
}
