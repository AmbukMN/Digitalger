// ─── BullMQ email queue — нэр + job payload + rate limit тохиргоо ──────────────
//
// ⚠️ AWS SES "max send rate" = 14 email/сек, 50,000/24ц. Энэ лимитийг ЗӨРЧИХГҮЙН
// тулд queue-д rate limiter тавина: max 10 job/сек (14-аас доош найдвартай зай).
// Олон API/worker instance байсан ч Bull limiter Redis-д тулгуурлан НИЙТ хурдыг
// хязгаарладаг тул нэгдсэн SES rate хэзээ ч 14-ийг давахгүй.

export const EMAIL_QUEUE = 'email';

// Bull queue limiter — нэг секундэд хамгийн ихдээ 10 job боловсруулна.
// (SES 14/сек limit-ээс доош, transient throttle-аас сэргийлнэ.)
export const EMAIL_RATE_LIMIT = { max: 10, duration: 1000 } as const;

// Имэйл job-ийн агуулга — queue нь зөвхөн "send"-д хэрэгтэй талбаруудыг дамжуулна.
// HTML-ийг producer тал (email.service template) бэлдсэн байна — processor зүгээр
// л email.service.sendRaw() дуудна (suppression/EmailLog send дотор).
export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  // Bulk/marketing job-ийн прогрессыг кампанит ажлаар тоолоход (status endpoint).
  campaign?: string;
}
