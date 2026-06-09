import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cloudflare Stream — ЗӨВХӨН төлбөртэй хичээлийн (course lesson) видеонд.
 * R2-аас ТУСДАА систем. Бусад бүх видео (preview г.м.) R2 дээрээ хэвээр.
 *
 * Урсгал: Frontend → Backend → Cloudflare Stream
 *  - createDirectUpload: admin хичээл нэмэхэд browser шууд Stream рүү upload хийх
 *    нэг удаагийн URL үүсгэнэ (backend-ээр дамжихгүй — том файлд тохиромжтой).
 *  - getSignedPlaybackToken: худалдан авсан хэрэглэгчид зөвхөн signed playback
 *    token олгоно (шууд нийтийн хандалт хаагдсан).
 *  - getVideoStatus: боловсруулалтын төлөв + үргэлжлэх хугацаа + thumbnail.
 */
@Injectable()
export class CloudflareStreamService {
  private readonly logger = new Logger(CloudflareStreamService.name);
  private readonly accountId?: string;
  private readonly token?: string;
  private readonly apiBase: string;

  constructor(private readonly config: ConfigService) {
    const stream = this.config.get<{ accountId?: string; token?: string }>('stream');
    this.accountId = stream?.accountId;
    this.token = stream?.token;
    this.apiBase = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`;
    if (this.configured) {
      this.logger.log('Cloudflare Stream тохируулагдлаа (хичээлийн видео)');
    } else {
      this.logger.warn('Cloudflare Stream тохируулаагүй (CLOUDFLARE_ACCOUNT_ID/STREAM_TOKEN)');
    }
  }

  get configured(): boolean {
    return !!this.accountId && !!this.token;
  }

  private headers(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  /**
   * Browser→Stream шууд upload хийх нэг удаагийн tus upload URL үүсгэнэ.
   * @param opts.maxDurationSeconds дээд хязгаар (default 4 цаг)
   * @param opts.name видеоны нэр (admin reference)
   * @returns { uploadURL, uid } — uid-г Lesson.videoStreamId-д хадгална.
   * ⚠️ requireSignedURLs:true — нийтийн шууд хандалтыг хаана (зөвхөн signed token).
   */
  async createDirectUpload(opts: { maxDurationSeconds?: number; name?: string }): Promise<{ uploadURL: string; uid: string }> {
    if (!this.configured) throw new Error('Cloudflare Stream тохируулаагүй');
    const res = await fetch(`${this.apiBase}/direct_upload`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        maxDurationSeconds: opts.maxDurationSeconds ?? 4 * 60 * 60,
        requireSignedURLs: true, // нийтийн хандалт хаалттай — зөвхөн signed token
        ...(opts.name ? { meta: { name: opts.name } } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      this.logger.error(`Stream direct_upload алдаа: ${JSON.stringify(data?.errors ?? data)}`);
      throw new Error('Stream upload URL үүсгэж чадсангүй');
    }
    return { uploadURL: data.result.uploadURL, uid: data.result.uid };
  }

  /**
   * Signed playback token — зөвхөн худалдан авсан хэрэглэгчид (entitlement backend
   * дээр аль хэдийн шалгасан байна). HLS/DASH/iframe playback-д ашиглана.
   * @param uid видеоны Stream uid
   * @param ttlSeconds token хүчинтэй хугацаа (default 4 цаг)
   */
  async getSignedPlaybackToken(uid: string, ttlSeconds = 4 * 60 * 60): Promise<string> {
    if (!this.configured) throw new Error('Cloudflare Stream тохируулаагүй');
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const res = await fetch(`${this.apiBase}/${uid}/token`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ exp }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data.result?.token) {
      this.logger.error(`Stream token алдаа (${uid}): ${JSON.stringify(data?.errors ?? data)}`);
      throw new Error('Playback token үүсгэж чадсангүй');
    }
    return data.result.token as string;
  }

  /**
   * Видеоны төлөв (боловсруулалт), үргэлжлэх хугацаа, thumbnail.
   * @returns { status, durationSec, thumbnail, ready }
   */
  async getVideoStatus(uid: string): Promise<{ status: string; durationSec: number | null; thumbnail: string | null; ready: boolean }> {
    if (!this.configured) throw new Error('Cloudflare Stream тохируулаагүй');
    const res = await fetch(`${this.apiBase}/${uid}`, { headers: this.headers() });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error('Stream видео төлөв авч чадсангүй');
    }
    const r = data.result;
    const state = r?.status?.state ?? 'unknown'; // pendingupload | queued | inprogress | ready | error
    return {
      status: state,
      durationSec: r?.duration ? Math.round(r.duration) : null,
      thumbnail: r?.thumbnail ?? null,
      ready: state === 'ready',
    };
  }

  /** Видеог Stream-аас устгах (хичээл/видео устгахад). */
  async deleteVideo(uid: string): Promise<void> {
    if (!this.configured || !uid) return;
    await fetch(`${this.apiBase}/${uid}`, { method: 'DELETE', headers: this.headers() }).catch(() => null);
  }

  /**
   * Аккаунтын БҮХ Stream видеог жагсаана (orphan cleanup cron-д ашиглана).
   * Cloudflare хариу нь нэг удаад дээд тал нь ~1000 видео буцаадаг тул
   * `created` талбараар хуудаслаж (asc) бүгдийг цуглуулна.
   * @returns { uid, created } массив — created нь ISO огноо (saяхан upload хамгаалах).
   */
  async listVideos(): Promise<{ uid: string; created: string | null }[]> {
    if (!this.configured) return [];
    const all: { uid: string; created: string | null }[] = [];
    const seen = new Set<string>();
    let asc: string | undefined; // сүүлчийн created-аас цааш хуудаслах cursor
    // Аюулгүйн хязгаар — хязгааргүй давталтаас сэргийлэх (50k видео хүртэл).
    for (let page = 0; page < 50; page++) {
      const url = new URL(this.apiBase);
      url.searchParams.set('asc', 'true');
      if (asc) url.searchParams.set('after', asc);
      const res = await fetch(url.toString(), { headers: this.headers() }).catch(() => null);
      if (!res) break;
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !Array.isArray(data.result)) {
        this.logger.warn(`Stream listVideos алдаа: ${JSON.stringify(data?.errors ?? 'fetch failed')}`);
        break;
      }
      const batch: any[] = data.result;
      let added = 0;
      for (const v of batch) {
        if (!v?.uid || seen.has(v.uid)) continue;
        seen.add(v.uid);
        all.push({ uid: v.uid, created: v.created ?? null });
        added += 1;
      }
      // Дараагийн хуудасны cursor — энэ багцын хамгийн сүүлийн created.
      const last = batch[batch.length - 1];
      if (!last?.created || added === 0) break;
      asc = last.created;
      if (batch.length < 1000) break; // сүүлийн хуудас
    }
    return all;
  }

  /**
   * Cloudflare Stream автомат thumbnail (poster) URL.
   * ⚠️ Thumbnail нь НИЙТЭД нээлттэй (signed token шаардахгүй) — requireSignedURLs нь
   * зөвхөн видео playback-д үйлчилнэ. videodelivery.net домэйн customer-code шаардахгүй
   * тул account бүрд найдвартай ажиллана.
   * @param uid видеоны Stream uid
   * @param time эхнээс хэдэн секундын frame (default '2s' — эхний 2 секунд)
   */
  getThumbnailUrl(uid: string, time = '2s'): string {
    return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=${time}`;
  }

  /** Signed HLS playback manifest URL (player-д шууд өгөх боломжтой). */
  hlsUrl(uid: string, token: string): string {
    return `https://videodelivery.net/${token}/manifest/video.m3u8`;
  }

  /** Cloudflare Stream iframe player URL (signed token-той). */
  iframeUrl(token: string): string {
    return `https://iframe.videodelivery.net/${token}`;
  }
}
