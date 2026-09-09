import { Injectable, Logger } from '@nestjs/common';
import { currentSite } from '../../common/site/site-context';
import { DEFAULT_SITE } from '../../common/site/site.constants';

const GRAPH = 'https://graph.facebook.com/v21.0';
/** ⚠️ Дуудлага бүрд timeout — Meta удаашрахад админ гацна */
const TIMEOUT_MS = 15_000;
/** ⚠️ Илрүүлэлт нь 4-6 Graph дуудлага — хуудас бүрд давтахгүй */
const CACHE_MS = 5 * 60_000;

export interface SocialAccount {
  /** Facebook Page ID эсвэл Instagram Business ID */
  id: string;
  name: string;
  kind: 'FACEBOOK' | 'INSTAGRAM';
  /** ⚠️ Токен ХЭЗЭЭ Ч frontend рүү явахгүй — зөвхөн сервер дотор */
  token: string;
  /** IG-ийн эцэг Facebook page (IG нь эцгийнхээ токеноор ажилладаг) */
  parentPageId?: string;
  /** IG-д зөвхөн `username` байдаг */
  username?: string;
  pictureUrl?: string;
}

/**
 * ⚠️⚠️ ХОЛБОГДСОН БҮХ PAGE / IG-Г ИЛРҮҮЛНЭ.
 *
 * Өмнө нь `meta-graph.service.ts` нь `FB_PAGE_ACCESS_TOKEN` + `IG_USER_ID`
 * гэсэн ГАНЦ хосыг л мэддэг байв. Хэрэглэгч 2+ page-тэй болоход:
 *   · Хоёр дахь page-ийн постыг ОГТ уншиж чадахгүй
 *   · Page хооронд пост дамжуулах боломжгүй
 *
 * ЭХ СУРВАЛЖ (дараалал чухал — эхнийх нь давуу):
 *   1. `FB_PAGE_ACCESS_TOKEN`  + `FB_PAGE_ID`      ← үндсэн
 *   2. `FB_PAGE_ACCESS_TOKEN_N` + `FB_PAGE_ID_N`   ← N = 2…20
 *   3. Токен бүрийн `/me/accounts` — нэг токен олон page-д хүрч
 *      болно (System User токен ихэвчлэн бүгдийг агуулна)
 *
 * ⚠️ `/me/accounts` нь USER токенд л ажилладаг. PAGE токенд `(#100)`
 *    буцаана — тэр нь АЛДАА БИШ, зүгээр л алгасна.
 *
 * ⚠️ Илрүүлэлтийг КЭШЛЭНЭ — админ хуудас нээх бүрд 6+ Graph дуудлага
 *    хийвэл Meta-гийн rate limit-д ойртоно.
 */
@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);
  /**
   * ⚠️⚠️ КЭШ САЙТААР САЛСАН — өмнө нь ГАНЦ объект байсан.
   *
   * Нэг сайтын жагсаалт нөгөөд өгөгдвөл админ буруу хуудас сонгож
   * нийтэлнэ. Түлхүүр нь `currentSite()`.
   */
  private cacheBySite = new Map<string, { at: number; rows: SocialAccount[] }>();

  /** ⚠️ Токен солиход шууд шинэчлэхийн тулд (admin товч) */
  invalidate(): void {
    /* ⚠️ ЗӨВХӨН одоогийн сайтынхыг — нөгөөгийн кэш хүчинтэй хэвээр */
    this.cacheBySite.delete(currentSite());
  }

  private async graph<T>(path: string, token: string): Promise<T | null> {
    const url = `${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      /* ⚠️ Сүлжээ/timeout — нэг токен унасан нь БУСДЫГ зогсоох ёсгүй */
      return null;
    }
  }

  /** env-ээс тохируулсан бүх токеныг цуглуулна (давхардлыг хасна) */
  private envTokens(): { token: string; hintId?: string }[] {
    /**
     * ⚠️⚠️ САЙТ БҮРД ӨӨРИЙН ТОКЕН — env угтвараар.
     *
     * ⛔ БОДИТ АЛДАА (2026-09-09 аудит): энэ функц сайтын контекстийг
     * ОГТ харгалздаггүй байсан. Улмаас BestFilm сонгосон админ
     * `/admin/crosspost/accounts` дуудахад **BestTV-ийн 4 жинхэнэ
     * Facebook/Instagram хуудас** харагдаж, `enqueue`/`relay` дарвал
     * **BestTV-ийн production хуудсанд бодитоор нийтлэгдэх** байсан.
     * UI дээр «BestFilm» гэж харагдаж байхад.
     *
     * ⚠️ BestTV-ийнх ЯГ ХЭВЭЭР: `besttv` → угтваргүй `FB_PAGE_*`.
     * Шинэ сайтад `BESTFILM_FB_PAGE_ACCESS_TOKEN*` гэж тохируулна.
     *
     * ⚠️ Тохируулаагүй бол ХООСОН буцаана — тэр үед админ хуудас
     * харахгүй, нийтлэх ч боломжгүй. Энэ нь БУРУУ хуудсанд
     * нийтлэхээс хамаагүй дээр.
     */
    const site = currentSite();
    const pfx = site === DEFAULT_SITE ? '' : `${site.toUpperCase()}_`;

    const out: { token: string; hintId?: string }[] = [];
    const push = (token?: string, hintId?: string) => {
      if (!token) return;
      if (out.some((t) => t.token === token)) return;
      out.push({ token, hintId });
    };
    push(process.env[`${pfx}FB_PAGE_ACCESS_TOKEN`], process.env[`${pfx}FB_PAGE_ID`]);
    for (let i = 2; i <= 20; i += 1) {
      push(process.env[`${pfx}FB_PAGE_ACCESS_TOKEN_${i}`], process.env[`${pfx}FB_PAGE_ID_${i}`]);
    }
    return out;
  }

  /**
   * Холбогдсон бүх Facebook page + Instagram акаунт.
   *
   * ⚠️ Алдаа гарсан токеныг чимээгүй алгасана — нэг токен унасан нь
   *    бусад хуудсыг харуулахад саад болох ёсгүй.
   */
  async list(force = false): Promise<SocialAccount[]> {
    const site = currentSite();
    const hit = this.cacheBySite.get(site);
    if (!force && hit && Date.now() - hit.at < CACHE_MS) {
      return hit.rows;
    }

    const byId = new Map<string, SocialAccount>();

    for (const { token, hintId } of this.envTokens()) {
      /* ── 1) Токен өөрөө аль page-ийнх вэ (`/me`) ── */
      const me = await this.graph<{ id?: string; name?: string }>('me?fields=id,name', token);
      if (me?.id && me.name) {
        byId.set(me.id, { id: me.id, name: me.name, kind: 'FACEBOOK', token });
      } else if (hintId) {
        /* ⚠️ `/me` унасан ч env-д ID байвал ашиглана — токен нь
           тухайн page-д хүчинтэй байж, зөвхөн `/me` хаалттай байж
           болно (granular scope). */
        const p = await this.graph<{ id?: string; name?: string }>(
          `${hintId}?fields=id,name`,
          token,
        );
        if (p?.id && p.name) {
          byId.set(p.id, { id: p.id, name: p.name, kind: 'FACEBOOK', token });
        }
      }

      /* ── 2) `/me/accounts` — нэг токен ОЛОН page-д хүрч болно ── */
      const accounts = await this.graph<{
        data?: { id: string; name: string; access_token?: string }[];
      }>('me/accounts?fields=id,name,access_token&limit=100', token);
      for (const p of accounts?.data ?? []) {
        if (!p.id || !p.name) continue;
        /* ⚠️ Page-ийн ӨӨРИЙН токен давуу — эцгийн токеноор зарим
           үйлдэл (нийтлэх) татгалздаг */
        const existing = byId.get(p.id);
        if (!existing || p.access_token) {
          byId.set(p.id, {
            id: p.id,
            name: p.name,
            kind: 'FACEBOOK',
            token: p.access_token || existing?.token || token,
          });
        }
      }
    }

    /* ── 3) Page бүрийн холбогдсон Instagram ── */
    const pages = [...byId.values()];
    for (const page of pages) {
      const ig = await this.graph<{
        instagram_business_account?: { id: string; username?: string; name?: string;
          profile_picture_url?: string };
      }>(
        `${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url}`,
        page.token,
      );
      const acc = ig?.instagram_business_account;
      if (!acc?.id) continue;
      byId.set(acc.id, {
        id: acc.id,
        /* ⚠️ IG-д `name` байхгүй байж болно — `username` руу унана */
        name: acc.name || acc.username || 'Instagram',
        kind: 'INSTAGRAM',
        /* ⚠️⚠️ IG нь ЭЦЭГ page-ийн токеноор ажилладаг — өөрийн токен
           БАЙХГҮЙ. Буруу токен өгвөл `(#100) Object does not exist`. */
        token: page.token,
        parentPageId: page.id,
        username: acc.username,
        pictureUrl: acc.profile_picture_url,
      });
    }

    /* ── 4) env-д заасан IG (page-ээс олдоогүй тохиолдолд) ── */
    const envIg = process.env.IG_USER_ID;
    if (envIg && !byId.has(envIg)) {
      const main = pages[0];
      if (main) {
        const acc = await this.graph<{ id?: string; username?: string;
          profile_picture_url?: string }>(
          `${envIg}?fields=id,username,profile_picture_url`,
          main.token,
        );
        if (acc?.id) {
          byId.set(acc.id, {
            id: acc.id,
            name: acc.username || 'Instagram',
            kind: 'INSTAGRAM',
            token: main.token,
            parentPageId: main.id,
            username: acc.username,
            pictureUrl: acc.profile_picture_url,
          });
        }
      }
    }

    const rows = [...byId.values()].sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'FACEBOOK' ? -1 : 1,
    );
    this.cacheBySite.set(site, { at: Date.now(), rows });
    this.logger.log(
      `Сошиал акаунт илрүүлэв: ${rows.filter((r) => r.kind === 'FACEBOOK').length} page, ` +
        `${rows.filter((r) => r.kind === 'INSTAGRAM').length} Instagram`,
    );
    return rows;
  }

  /** Нэг акаунтыг ID-аар — токен нь дотор нь байна */
  async byId(id: string): Promise<SocialAccount | undefined> {
    return (await this.list()).find((a) => a.id === id);
  }

  /**
   * ⚠️ Frontend рүү явуулах ХУВИЛБАР — токен ХАСНА.
   * Токен нь Page-ийн бүрэн эрхтэй тул ил гарвал хэн ч нийтэлж чадна.
   */
  async listPublic(force = false) {
    return (await this.list(force)).map(({ token: _t, ...rest }) => rest);
  }
}
