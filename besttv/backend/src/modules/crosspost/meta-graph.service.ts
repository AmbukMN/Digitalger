import { Injectable, Logger } from '@nestjs/common';

/** Graph API хувилбар — `chat.service.ts`-тэй ИЖИЛ байх ёстой */
const GRAPH = 'https://graph.facebook.com/v21.0';

/** Facebook постын attachment (медиа) */
export interface FbAttachment {
  type: string;
  url: string | null;
  /** Дэд attachment — олон зурагтай пост (album) */
  subattachments?: FbAttachment[];
}

/** Facebook Page-ийн нэг пост */
export interface FbPost {
  id: string;
  message: string;
  createdTime: string;
  permalink: string | null;
  attachments: FbAttachment[];
  /** Facebook дээрх статик preview зураг (жагсаалтад харуулах) */
  previewUrl: string | null;
}

/**
 * Meta Graph API-тай харилцах НЭГ цэг.
 *
 * ⚠️ Өмнө нь `chat.service.ts` дотор inline `fetch` байсан — энэ нь
 * анхны дахин ашиглагдах клиент. Токен алдагдах/дуусах үед бүх дуудлага
 * ижилхэн ажиллах ёстой тул алдааны боловсруулалтыг ЭНД төвлөрүүлэв.
 */
@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);

  /**
   * ⚠️ `process.env`-ээс шууд — `chat.service.ts` ч ингэж уншдаг.
   * ConfigService-д оруулбал ХОЁР эх сурвалж болж, аль нэг нь
   * хоцрогдох эрсдэлтэй.
   */
  private get token(): string {
    return process.env.FB_PAGE_ACCESS_TOKEN ?? '';
  }

  /** Instagram Business акаунтын ID (Page-тэй холбоотой) */
  private get igUserId(): string {
    return process.env.IG_USER_ID ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  isIgConfigured(): boolean {
    return Boolean(this.token && this.igUserId);
  }

  /**
   * Graph API дуудлага — алдааг УНШИГДАХ хэлбэрт хөрвүүлнэ.
   *
   * ⚠️ Meta-гийн алдааг ШУУД харуулбал админ юу хийхээ мэдэхгүй
   * («(#10) Requires instagram_content_publish permission» гэдгээс
   * ямар арга хэмжээ авахыг ойлгохгүй). Тиймээс монгол тайлбар руу
   * буулгана.
   */
  private async call<T>(
    path: string,
    init?: RequestInit & { params?: Record<string, string> },
  ): Promise<T> {
    if (!this.token) {
      throw new Error('Facebook токен тохируулаагүй байна (FB_PAGE_ACCESS_TOKEN)');
    }

    const params = new URLSearchParams(init?.params ?? {});
    params.set('access_token', this.token);
    const url = `${GRAPH}/${path}${path.includes('?') ? '&' : '?'}${params}`;

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        /* ⚠️ Timeout ЗААВАЛ — Meta удаашрахад хүсэлт мөнхөрч,
           админ «боловсруулж байна» дээр гацна */
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      const msg = String(e);
      if (msg.includes('timeout') || msg.includes('abort')) {
        throw new Error('Facebook хариу өгсөнгүй (30 секунд хүлээв). Дахин оролдоно уу.');
      }
      throw new Error(`Facebook-тэй холбогдож чадсангүй: ${msg}`);
    }

    const json = (await res.json().catch(() => null)) as
      | (T & { error?: { message?: string; code?: number; error_subcode?: number } })
      | null;

    if (!res.ok || json?.error) {
      const err = json?.error;
      throw new Error(this.humanError(err?.code, err?.error_subcode, err?.message));
    }
    return json as T;
  }

  /**
   * Meta-гийн алдааны кодыг МОНГОЛ, ҮЙЛДЭЛД ЧИГЛЭСЭН тайлбар болгоно.
   *
   * ⚠️ Админ «яах ёстой»-гоо мэдэх ёстой — зүгээр «алдаа гарлаа» гэвэл
   * дэмий дуудлага, гомдол л нэмэгдэнэ.
   */
  private humanError(code?: number, subcode?: number, raw?: string): string {
    /* Токен хүчингүй/дууссан — хамгийн түгээмэл, тусад нь */
    if (code === 190) {
      return 'Facebook токен хүчингүй болжээ. Шинэ Page token үүсгэж VPS дээрх FB_PAGE_ACCESS_TOKEN-ыг солино уу.';
    }
    if (code === 10 || code === 200) {
      /* Зөвшөөрөл дутуу — App Review шаардлагатай эсэхийг заана */
      if (raw?.includes('instagram_content_publish')) {
        return 'Instagram-д нийтлэх зөвшөөрөл (instagram_content_publish) байхгүй байна. Meta App Review-д хүсэлт гаргах шаардлагатай.';
      }
      return `Зөвшөөрөл дутуу байна: ${raw ?? 'тодорхойгүй'}`;
    }
    if (code === 4 || code === 17 || code === 32) {
      return 'Facebook-ийн хүсэлтийн хязгаарт хүрлээ. Хэсэг хүлээгээд дахин оролдоно уу.';
    }
    /* IG медиа татаж чадаагүй — хамгийн түгээмэл нийтлэлтийн алдаа */
    if (raw?.includes('media') && raw?.includes('download')) {
      return 'Instagram зураг/видеог татаж чадсангүй. Медиа хэт том эсвэл формат нь тохирохгүй байж болзошгүй.';
    }
    if (subcode === 2207026 || raw?.includes('aspect ratio')) {
      return 'Зургийн харьцаа Instagram-д тохирохгүй байна (4:5 — 1.91:1 хооронд байх ёстой).';
    }
    return raw ?? 'Тодорхойгүй алдаа гарлаа';
  }

  // ─── Facebook постууд ─────────────────────────────────────────────────────

  /**
   * Page-ийн постуудыг татна.
   *
   * ⚠️ `attachments{...}` нь ЗААВАЛ — үүнгүйгээр зураг/видеоны URL
   * ирэхгүй тул юуг ч шилжүүлж чадахгүй.
   */
  async fetchPosts(limit = 25, after?: string): Promise<{ posts: FbPost[]; next: string | null }> {
    const fields = [
      'id',
      'message',
      'created_time',
      'permalink_url',
      'full_picture',
      'attachments{media_type,type,media,url,subattachments{media_type,type,media,url}}',
    ].join(',');

    const params: Record<string, string> = { fields, limit: String(Math.min(100, limit)) };
    if (after) params.after = after;

    const data = await this.call<{
      data: RawFbPost[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>('me/posts', { params });

    return {
      posts: (data.data ?? []).map((p) => this.normalizePost(p)),
      /* ⚠️ `next` байхгүй бол цааш хуудас БАЙХГҮЙ — cursor байгаа
         эсэхээр шалгавал төгсгөлд хоосон хуудас гуйна */
      next: data.paging?.next ? (data.paging.cursors?.after ?? null) : null,
    };
  }

  /** Нэг постыг ID-гаар татна (дахин оролдох үед) */
  async fetchPost(fbPostId: string): Promise<FbPost> {
    const fields = [
      'id',
      'message',
      'created_time',
      'permalink_url',
      'full_picture',
      'attachments{media_type,type,media,url,subattachments{media_type,type,media,url}}',
    ].join(',');
    const raw = await this.call<RawFbPost>(fbPostId, { params: { fields } });
    return this.normalizePost(raw);
  }

  /** Graph API-ийн гүн бүтцийг хавтгай хэлбэрт буулгана */
  private normalizePost(p: RawFbPost): FbPost {
    const flatten = (a: RawAttachment): FbAttachment => ({
      type: a.media_type ?? a.type ?? 'unknown',
      /* ⚠️ Видеонд `media.source`, зурганд `media.image.src` */
      url: a.media?.source ?? a.media?.image?.src ?? null,
      subattachments: a.subattachments?.data?.map(flatten),
    });

    return {
      id: p.id,
      message: p.message ?? '',
      createdTime: p.created_time,
      permalink: p.permalink_url ?? null,
      previewUrl: p.full_picture ?? null,
      attachments: (p.attachments?.data ?? []).map(flatten),
    };
  }

  // ─── Instagram нийтлэл ────────────────────────────────────────────────────

  /**
   * IG медиа контейнер үүсгэнэ (нийтлэхийн ӨМНӨХ алхам).
   *
   * ⚠️ Instagram нь URL-ийг ӨӨРӨӨ татдаг тул хаяг нь ОЛОН НИЙТЭД
   * нээлттэй байх ёстой. Facebook CDN нь эрхийн шалгалттай тул шууд
   * өгвөл бүтэлгүйтдэг — иймээс R2 руу хуулж байж өгнө.
   */
  async createContainer(params: {
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    /** Carousel-ийн гишүүн — өөрөө нийтлэгдэхгүй */
    isCarouselItem?: boolean;
  }): Promise<string> {
    const body: Record<string, string> = {};
    if (params.imageUrl) body.image_url = params.imageUrl;
    if (params.videoUrl) {
      body.video_url = params.videoUrl;
      /* ⚠️ Meta нь 2024 оноос IG-д видеог ЗӨВХӨН Reels хэлбэрээр
         нийтлэхийг зөвшөөрдөг. `VIDEO` төрөл нь алдаа өгнө. */
      body.media_type = 'REELS';
    }
    if (params.caption) body.caption = params.caption;
    if (params.isCarouselItem) body.is_carousel_item = 'true';

    const res = await this.call<{ id: string }>(`${this.igUserId}/media`, {
      method: 'POST',
      params: body,
    });
    return res.id;
  }

  // ─── FACEBOOK PAGE РУУ НИЙТЛЭХ ─────────────────────────────────────────
  //
  // ⚠️⚠️ `pages_manage_posts` ЭРХ ШААРДАНА. Тэр эрхгүй үед Meta нь
  // HTTP 403 + code 200 буцаана. `call()` нь түүнийг монгол мессеж
  // болгож хөрвүүлдэг тул админ юу хийхээ мэднэ.

  /**
   * FB Page-д ТЕКСТ пост.
   *
   * ⚠️ `me/feed` — Page токен тул `me` нь Page өөрөө (`fetchPosts` ч
   * ингэж ажилладаг). Page ID-г тусад нь хадгалах шаардлагагүй.
   */
  async createPagePost(params: {
    message: string;
    /// Холбоос — FB нь preview карт автоматаар үүсгэнэ
    link?: string;
  }): Promise<string> {
    const body: Record<string, string> = { message: params.message };
    if (params.link) body.link = params.link;

    const res = await this.call<{ id: string }>('me/feed', {
      method: 'POST',
      params: body,
    });
    return res.id;
  }

  /**
   * FB Page-д ЗУРАГТАЙ пост.
   *
   * ⚠️ `/photos` edge — зураг нэг бол энэ, олон бол доорх
   * `createPagePhotoPost` (unpublished хэсгүүдээр).
   */
  async createPagePhoto(params: { imageUrl: string; caption?: string }): Promise<string> {
    const res = await this.call<{ id: string; post_id?: string }>('me/photos', {
      method: 'POST',
      params: {
        url: params.imageUrl,
        ...(params.caption ? { caption: params.caption } : {}),
      },
    });
    /* ⚠️ `post_id` нь ФИД дэх постын ID (`{page}_{post}`), `id` нь
       зургийнх. Админд харуулах/линк үүсгэхэд `post_id` хэрэгтэй. */
    return res.post_id ?? res.id;
  }

  /**
   * FB Page-д ОЛОН ЗУРАГТАЙ пост.
   *
   * ⚠️ Хоёр алхам: зураг бүрийг `published=false`-ээр байршуулаад,
   * дараа нь `attached_media`-аар нэг постод холбоно. Шууд олон
   * зураг илгээх API БАЙХГҮЙ.
   */
  async createPageMultiPhoto(params: {
    imageUrls: string[];
    message: string;
  }): Promise<string> {
    const ids: string[] = [];
    for (const url of params.imageUrls) {
      const r = await this.call<{ id: string }>('me/photos', {
        method: 'POST',
        params: { url, published: 'false' },
      });
      ids.push(r.id);
    }

    const attached: Record<string, string> = { message: params.message };
    ids.forEach((id, i) => {
      attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });

    const res = await this.call<{ id: string }>('me/feed', {
      method: 'POST',
      params: attached,
    });
    return res.id;
  }

  /**
   * FB Page-д ВИДЕО пост.
   *
   * ⚠️ Видео нь `/videos` edge — `graph-video.facebook.com` домэйн
   * ХЭРЭГГҮЙ (URL-ээр илгээх үед). Файл шууд upload хийвэл тэр
   * домэйн хэрэгтэй болно.
   */
  async createPageVideo(params: { videoUrl: string; description?: string }): Promise<string> {
    const res = await this.call<{ id: string }>('me/videos', {
      method: 'POST',
      params: {
        file_url: params.videoUrl,
        ...(params.description ? { description: params.description } : {}),
      },
    });
    return res.id;
  }

  /** Carousel контейнер — 2-10 гишүүнээс бүрдэнэ */
  async createCarouselContainer(childIds: string[], caption?: string): Promise<string> {
    const res = await this.call<{ id: string }>(`${this.igUserId}/media`, {
      method: 'POST',
      params: {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        ...(caption ? { caption } : {}),
      },
    });
    return res.id;
  }

  /**
   * Контейнер боловсруулагдаж дуустал хүлээнэ.
   *
   * ⚠️⚠️ ВИДЕОНД ЗААВАЛ. Instagram видеог өөрөө хөрвүүлдэг бөгөөд
   * дуусаагүй байхад `media_publish` дуудвал алдаа өгнө. Зурагт
   * ихэвчлэн шууд `FINISHED` боловч ялгаж боловсруулах шаардлагагүй.
   */
  async waitForContainer(containerId: string, maxWaitMs = 300_000): Promise<void> {
    const started = Date.now();
    let delay = 3_000;

    while (Date.now() - started < maxWaitMs) {
      const res = await this.call<{ status_code?: string; status?: string }>(containerId, {
        params: { fields: 'status_code,status' },
      });
      const code = res.status_code;

      if (code === 'FINISHED') return;
      if (code === 'ERROR' || code === 'EXPIRED') {
        throw new Error(
          `Instagram медиаг боловсруулж чадсангүй (${code}). ${res.status ?? ''}`.trim(),
        );
      }

      await new Promise((r) => setTimeout(r, delay));
      /* Аажим уртасгана — эхэндээ ойрхон, сүүлдээ ховор шалгана */
      delay = Math.min(15_000, Math.round(delay * 1.4));
    }
    throw new Error('Instagram медиаг боловсруулах хугацаа хэтэрлээ (5 минут).');
  }

  /** Контейнерийг ҮНЭХЭЭР нийтэлнэ → IG постын ID буцаана */
  async publishContainer(containerId: string): Promise<string> {
    const res = await this.call<{ id: string }>(`${this.igUserId}/media_publish`, {
      method: 'POST',
      params: { creation_id: containerId },
    });
    return res.id;
  }

  /**
   * IG нийтлэлийн үлдсэн хязгаарыг шалгана.
   *
   * ⚠️ Instagram нь 24 цагт 50 пост л зөвшөөрдөг. Хязгаарт хүрэхээс
   * ӨМНӨ анхааруулбал админ 30 постыг дараалалд оруулаад дунд нь
   * зогсох байдлаас сэргийлнэ.
   */
  async publishingLimit(): Promise<{ used: number; cap: number } | null> {
    try {
      const res = await this.call<{
        data?: { quota_usage?: number; config?: { quota_total?: number } }[];
      }>(`${this.igUserId}/content_publishing_limit`, {
        params: { fields: 'quota_usage,config' },
      });
      const row = res.data?.[0];
      if (!row) return null;
      return { used: row.quota_usage ?? 0, cap: row.config?.quota_total ?? 50 };
    } catch {
      /* ⚠️ Хязгаарыг мэдэхгүй нь нийтлэхийг зогсоох шалтгаан БИШ */
      return null;
    }
  }
}

// ─── Graph API-гийн түүхий хэлбэрүүд ────────────────────────────────────────

interface RawMedia {
  image?: { src?: string };
  source?: string;
}

interface RawAttachment {
  media_type?: string;
  type?: string;
  media?: RawMedia;
  url?: string;
  subattachments?: { data?: RawAttachment[] };
}

interface RawFbPost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: { data?: RawAttachment[] };
}
