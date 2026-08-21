import { Injectable, Logger } from '@nestjs/common';

/**
 * Чат доторх холбоосын OG урьдчилан харах мэдээлэл.
 *
 * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: чатбот нь тоо бичсэн хэрэглэгчид
 * «https://besttv.us/ руу орж үзээрэй» гэж хариулдаг. Гэтэл линк нь
 * нүцгэн текст болж харагдаад хэн ч дардаггүй байв. Facebook/Messenger
 * шиг зураг+гарчигтай карт харуулбал дарах магадлал эрс нэмэгдэнэ.
 */
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/**
 * ⚠️⚠️ ЗӨВХӨН ӨӨРИЙН ДОМЭЙН — SSRF-ээс хамгаална.
 *
 * Дурын URL татвал халдагч чатад дотоод хаяг (169.254.169.254 —
 * cloud metadata, эсвэл besttv-postgres:5432) бичээд сервер түүнийг
 * татаж, хариуг нь буцаана. Тиймээс цагаан жагсаалт ЗААВАЛ.
 */
const ALLOWED_HOSTS = ['besttv.us', 'www.besttv.us'];

/** ⚠️ Кэш — нэг линк олон чатад давтагдана, бүрд нь татах нь дэмий */
const CACHE_TTL_MS = 30 * 60_000;
/** ⚠️ Хязгаар — кэш хязгааргүй өсвөл санах ой алдагдана */
const CACHE_MAX = 200;
const FETCH_TIMEOUT_MS = 5_000;
/** ⚠️ HTML-ийн эхний хэсэгт л <head> байна — бүтнээр татах нь дэмий */
const MAX_BYTES = 120_000;

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly cache = new Map<string, { at: number; data: LinkPreview | null }>();

  /** HTML-ээс нэг meta тегийн утгыг гаргана */
  private meta(html: string, keys: string[]): string | null {
    for (const key of keys) {
      /* property/name аль ч дарааллаар байж болно — хоёуланг оролдоно */
      const patterns = [
        new RegExp(
          `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
          'i',
        ),
        new RegExp(
          `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
          'i',
        ),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return this.decode(m[1]).trim() || null;
      }
    }
    return null;
  }

  /** &amp; &#039; гэх HTML entity-г буцаана */
  private decode(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/gi, "'");
  }

  async fetchPreview(rawUrl: string): Promise<LinkPreview | null> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) return null;

    const key = url.toString();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    let data: LinkPreview | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(key, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          /* ⚠️ Next.js нь bot-д зориулж OG-г бүрэн gen хийдэг */
          'User-Agent': 'facebookexternalhit/1.1 (BestTV link preview)',
          Accept: 'text/html',
        },
      }).finally(() => clearTimeout(timer));

      if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
        /* ⚠️ Зөвхөн эхний хэсгийг уншина — том хуудсанд санах ой хэмнэнэ */
        const buf = await res.arrayBuffer();
        const html = Buffer.from(buf.slice(0, MAX_BYTES)).toString('utf8');

        const title =
          this.meta(html, ['og:title', 'twitter:title']) ??
          this.decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim() ??
          null;

        data = {
          url: key,
          title: title || null,
          description: this.meta(html, ['og:description', 'twitter:description', 'description']),
          image: this.meta(html, ['og:image', 'twitter:image']),
          siteName: this.meta(html, ['og:site_name']),
        };
        /* Гарчиг ч зураг ч байхгүй бол карт харуулах утгагүй */
        if (!data.title && !data.image) data = null;
      }
    } catch (e) {
      /* ⚠️ Урьдчилан харах бүтэлгүйтэх нь чатыг ЭВДЭХГҮЙ — линк текст хэвээр */
      this.logger.warn(`OG татаж чадсангүй (${key}): ${String(e).slice(0, 120)}`);
      data = null;
    }

    /* ⚠️ Бүтэлгүйтлийг ч кэшлэнэ — унасан хуудсыг дахин дахин татахгүй */
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }
}
