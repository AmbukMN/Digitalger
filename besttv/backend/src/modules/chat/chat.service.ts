import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentSite } from '../../common/site/site-context';
import { DEFAULT_SITE } from '../../common/site/site.constants';
/* ⚠️ N8nService нь @Global тул module-д импортлох шаардлагагүй */
import { N8nService } from '../n8n/n8n.service';
/* ⚠️ StorageModule нь @Global тул module-д импортлох шаардлагагүй */
import { StorageService } from '../../storage/storage.service';
import { LinkPreviewService } from './link-preview.service';

/**
 * ⚠️⚠️ `facebook`/`instagram` ЗААВАЛ — n8n чатбот эдгээр сувгаас
 * мессеж дамжуулна. Жагсаалтад байхгүй бол чимээгүйгээр `web` болж,
 * админ панель дээр FB/IG-ээс ирсэн яриаг вэбийнхээс ЯЛГАЖ ЧАДАХГҮЙ
 * (schema-д `@@index([channel, lastMessageAt])` байгаа нь энэ ялгааг
 * хийхээр ТӨЛӨВЛӨСӨН гэдгийг харуулж байна).
 *
 * ⚠️ Чөлөөт текст болгож нээхгүй — endpoint нээлттэй тул дурын утга
 * оруулбал админы шүүлт замбараагүй болно.
 */
const ALLOWED_CHANNELS = new Set(['web', 'facebook', 'instagram']);
/**
 * ⚠️⚠️ `admin` ЗОРИУД БАЙХГҮЙ — `saveMessage` нь НЭЭЛТТЭЙ endpoint-оос
 * дуудагддаг тул халдлагч "админ" нэрийн өмнөөс мессеж бичиж phishing
 * хийж болно ("картын мэдээллээ энд илгээнэ үү").
 * Админы хариу нь `adminReply()`-аар л бичигдэнэ (тэр нь `saveMessage`
 * дамждаггүй, `@Roles(ADMIN)` хамгаалалттай).
 */
const ALLOWED_ROLES = new Set(['user', 'assistant']);
const MAX_TEXT_LENGTH = 8000;

/**
 * ⚠️⚠️ КАРТЫН ТОО БА ТАЛБАРЫН УРТ — ХАТУУ ХЯЗГААР.
 *
 * ⛔ БОДИТ ЦООРХОЙ (2026-09-09 аудит): `titles` нь ХЯЗГААРГҮЙ байсан.
 * `POST /chat/save` нь `OptionalJwtAuthGuard` (зочин ч бичнэ), DTO
 * класс биш (bare inline type тул `ValidationPipe` идэвхгүй),
 * throttle 120/сек. Улмаас НЭВТРЭЛТГҮЙ халдагч ~10MB (express-ийн
 * body хязгаар) `titles` массив илгээж, нэг JSONB мөрөнд бичүүлнэ.
 * Минутанд олон GB → диск дүүрч, төлбөрийн урсгал ХАМТ УНАНА.
 *
 * ⚠️ Хажуугийн `sessionId` (64), `text` (8000), `pageId` (regex)
 * БҮГД хязгаартай байсан — зөвхөн энэ мартагдсан.
 */
const MAX_TITLE_CARDS = 20;
const MAX_CARD_FIELD = 500;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** n8n-ээс ирэх санал болгосон кино */
export interface ChatTitleCard {
  id: string;
  title: string;
  slug: string;
  posterUrl?: string;
  /**
   * ⚠️ Хэвтээ дэвсгэр — постергүй кинонд ОРЛУУЛНА.
   *
   * 164 идэвхтэй киноны 91 нь зөвхөн постертой, 73 нь backdrop-той
   * тул аль нэг нь дутуу байх нь ЭНГИЙН ЗҮЙЛ. Хоёуланг нь дамжуулж
   * байж карт үргэлж зурагтай гарна.
   */
  backdropUrl?: string;
  /**
   * ⚠️⚠️ Messenger картан дээр ЯГ ХАРАГДАХ хоёр дахь мөр
   * («2026 · 📺 Цуврал · 🔒 Багцтай» гэх мэт).
   *
   * Админ панел LIVE дээр юу харагдаж байгааг ТЭР ЧИГЭЭР нь
   * харуулах ёстой. Он/үнэлгээг өөрөө эвлүүлбэл FB дээрхээс
   * ӨӨР текст гарч, админ буруу зүйл хараад дүгнэнэ.
   */
  subtitle?: string;
  url?: string;
  year?: number;
  rating?: number;
}

export interface SaveMessageInput {
  channel?: string;
  /**
   * ⚠️ FB/IG page id — олон page-тэй үед аль нь болохыг ялгана.
   *
   * БОДИТ ХЭРЭГЦЭЭ: BestTV нь ХОЁР Facebook page-тэй. Админ чат
   * самбарт хоёулаа «FB» гэж нийлж харагдвал аль хуудсанд
   * хариулж байгаагаа мэдэхгүй, буруу нэрийн өмнөөс хариулна.
   *
   * ⚠️ Вэб чатад байхгүй (undefined).
   */
  pageId?: string;
  sessionId: string;
  role: string;
  text: string;
  userName?: string;
  userImage?: string;
  userId?: string;
  titles?: ChatTitleCard[];
  /** FB/IG хавсралтын ТҮР URL — R2 руу хуулж key болгоно */
  attachmentUrl?: string;
  /** image | file | video */
  attachmentType?: string;
}

/** Хавсралтын дээд хэмжээ — 10MB (баримтын зураг үүнээс хэтрэхгүй) */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Чатын лог — n8n AI туслахтай хийсэн яриаг хадгалж, админд харуулна.
 *
 * ⚠️ AI-ийн ЯРИАНЫ САНАХ ОЙ энд БАЙХГҮЙ — n8n-ийн Postgres memory-д байдаг.
 * Энд зөвхөн CRM зорилгын лог + админы гар хариулт.
 *
 * ⚠️ Бүх бичилт fail-open: чат хэзээ ч 500 өгөхгүй, `{ ok: true }` буцаана.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
    private readonly storage: StorageService,
    private readonly preview: LinkPreviewService,
  ) {}

  /**
   * FB/IG профайлыг Meta-гаас НӨХӨЖ татна.
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: чатбот нь мессеж ирэх агшинд профайл
   * татдаг. Тэр агшинд Meta татгалзвал (эрх дутуу, түр саатал)
   * яриа НЭРГҮЙ үлдэж, дараа нь ДАХИН оролддоггүй. Хэрэглэгч
   * дахин бичихгүй бол мөнхөд «Messenger #4380» хэвээр.
   *
   * БОДИТ ТОХИОЛДОЛ: `instagram_manage_messages` эрх нээгдсэн ч
   * өмнөх 242 яриа хоосон хэвээр байв.
   *
   * ⚠️ Placeholder нь ЗӨВХӨН жинхэнэ дата авч ЧАДААГҮЙ үед —
   *    `displayName()` нь `userName` хоосон байвал л нөөц нэр
   *    үүсгэдэг тул энэ метод амжилттай болмогц бодит нэр гарна.
   *
   * ⚠️ Алдаа гарвал ЧИМЭЭГҮЙ алгасна — энэ нь нэмэлт сайжруулалт,
   *    хэрэглэгчийн урсгалыг ХЭЗЭЭ Ч тасалж болохгүй.
   */
  async backfillProfiles(limit = 50): Promise<{ scanned: number; filled: number }> {
    /**
     * ⚠️ САЙТЫН угтвартай — эс бөгөөс BestTV-ийн токен байхгүй үед
     * BestFilm-ийнхийг ч бүхэлд нь унтраана (эсрэгээр ч).
     */
    if (!process.env[`${this.envPrefix()}FB_PAGE_ACCESS_TOKEN`]) {
      return { scanned: 0, filled: 0 };
    }

    const rows = await this.prisma.chatConversation.findMany({
      where: {
        channel: { in: ['facebook', 'instagram'] },
        /**
         * ⚠️ Нэр БАЙГАА ч ЗУРАГГҮЙ мөрийг ч хамруулна.
         *
         * FB/IG-ийн зургийн URL нь ХУГАЦААТАЙ (signed) тул хэдэн
         * долоо хоногт үхдэг — идэвхгүй яриа бүр эцэстээ
         * аватаргүй үлдэнэ. Мөн нэр татагдаад зураг нь таслагдсан
         * тохиолдол бий.
         */
        OR: [
          { userName: null },
          { userName: '' },
          { userImage: null },
          { userImage: '' },
        ],
      },
      /* ⚠️ Хамгийн сүүлд идэвхтэй байсныг ЭХЭЛЖ — админ тэднийг
         хардаг, хуучирсан яриа хойно ч болно */
      orderBy: { lastMessageAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
      /* ⚠️ `pageId` ЗААВАЛ — хоёр page-тэй тул токен сонгоно */
      select: { id: true, sessionId: true, channel: true, pageId: true },
    });

    let filled = 0;
    /* ⚠️ Алдааг НЭГ л удаа логлоно (доорх тайлбар) */
    let loggedError = false;
    for (const c of rows) {
      /* ⚠️ IG нь `username`-тэй, FB нь `first_name` — талбар ӨӨР */
      const fields =
        c.channel === 'instagram'
          ? 'name,username,profile_pic'
          : 'name,first_name,profile_pic';
      /* ⚠️ Тухайн page-ийн токен — Best Tv 2-ынх өөр */
      const token = this.pageToken(c.pageId);
      if (!token) continue;
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(c.sessionId)}` +
            `?fields=${fields}&access_token=${token}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!res.ok) {
          /**
           * ⚠️⚠️ ЯАГААД АЖИЛЛААГҮЙГ ЛОГЛОНО — өмнө нь ЧИМЭЭГҮЙ
           * алгасдаг байсан тул админ «яагаад нэр/аватар ирэхгүй
           * байна вэ» гэдгийг мэдэх ямар ч зам байгаагүй.
           *
           * Гарч болох алдаанууд (бодитоор шалгасан):
           *   · code 190 — токен ХҮЧИНГҮЙ (дахин үүсгэнэ)
           *   · code 3   — App-д «Business Asset User Profile Access»
           *                Advanced Access БАЙХГҮЙ (App Review)
           *   · code 230 — IG: хэрэглэгч зөвхөн КОММЕНТ бичсэн, DM
           *                илгээгээгүй тул зөвшөөрөл алга (ХЭВИЙН)
           *
           * ⚠️ Нэг л удаа бичнэ — 291 яриа бүрд лог бичвэл дүүрнэ.
           */
          if (!loggedError) {
            loggedError = true;
            const body = await res.text().catch(() => '');
            this.logger.warn(
              `Чат профайл татаж чадсангүй (${c.channel}): ${body.slice(0, 200)}`,
            );
          }
          continue;
        }
        const j = (await res.json()) as {
          name?: string;
          first_name?: string;
          username?: string;
          profile_pic?: string;
        };
        const name = (j.name || j.first_name || j.username || '').trim();
        const pic = (j.profile_pic || '').trim();
        if (!name && !pic) continue;

        await this.prisma.chatConversation.update({
          where: { id: c.id },
          data: {
            ...(name ? { userName: name.slice(0, 300) } : {}),
            ...(pic ? { userImage: pic.slice(0, 2048) } : {}),
          },
        });
        filled += 1;
      } catch {
        /* ⚠️ Сүлжээ/timeout — дараагийн ажиллалтад дахин оролдоно */
      }
    }

    if (filled > 0) {
      this.logger.log(`Чат профайл нөхөв: ${filled}/${rows.length}`);
    }
    return { scanned: rows.length, filled };
  }

  /**
   * ⚠️⚠️ PAGE → ТОКЕН зураглал (ХЭДЭН Ч ХУУДАС).
   *
   * BestTV нь ОЛОН Facebook page-тэй (Best TV, Best Tv 2, BestTV Шилдэг…).
   * Meta нь page тус бүрийн ӨӨРИЙН токеныг шаарддаг — өөр page-ийн
   * хэрэглэгч рүү илгээвэл `(#100) No matching user found` буцаана.
   * Зурвас ОГТ ХҮРЭХГҮЙ, админ мэдэхгүй үлдэнэ.
   *
   * ⚠️ Өмнө нь ЗӨВХӨН 2 хуудас дэмждэг байсан (`if pageId === secondId`).
   *    Гурав дахь хуудас нэмэгдвэл ЧИМЭЭГҮЙ анхдагч токен руу унаж,
   *    бүх зурвас амжилтгүй болно. Одоо env-ээс ДИНАМИКААР уншина.
   *
   * ФОРМАТ (дугаарлалт 2-оос эхэлнэ, үндсэн нь дугааргүй):
   *   FB_PAGE_ACCESS_TOKEN    + FB_PAGE_ID      ← үндсэн
   *   FB_PAGE_ACCESS_TOKEN_2  + FB_PAGE_ID_2
   *   FB_PAGE_ACCESS_TOKEN_3  + FB_PAGE_ID_3    ← шинэ хуудас ингэж нэмнэ
   *   … (хязгааргүй)
   *
   * ⚠️ Instagram нь ЭЦЭГ Facebook page-ийн токеноор ажилладаг тул
   *    `IG_USER_ID`-г ч зураглалд оруулна (IG чат буруу токен авахгүй).
   *
   * ⚠️ Тохирох хуудас олдоогүй бол үндсэн токен руу унана — хуучин
   *    зан үйл хэвээр, шинэ алдаа үүсгэхгүй.
   */
  /**
   * ⚠️⚠️ САЙТЫН УГТВАР — `crosspost/meta-graph.service.ts` -тэй ИЖИЛ.
   *
   * ⛔ БОДИТ ЭРСДЭЛ (2026-09-09 аудит): энэ функц сайтын контекстийг
   * харгалздаггүй байсан тул BestFilm-д FB хуудас нэмэгдмэгц админы
   * хариу **BestTV-ийн production хуудсаар** явах байсан.
   *
   * ⚠️ BestTV-ийнх ЯГ ХЭВЭЭР: `besttv` → угтваргүй `FB_PAGE_ACCESS_TOKEN`.
   * ⚠️ Тохируулаагүй сайтад `undefined` буцаана → зурвас илгээгдэхгүй,
   *    буруу хуудсанд бичихээс НЬ ДЭЭР (fail-closed).
   */
  private envPrefix(): string {
    const site = currentSite();
    return site === DEFAULT_SITE ? '' : `${site.toUpperCase()}_`;
  }

  private pageToken(pageId?: string | null): string | undefined {
    const px = this.envPrefix();
    const main = process.env[`${px}FB_PAGE_ACCESS_TOKEN`];
    if (!pageId) return main;

    /* ⚠️ Үндсэн хуудас — `FB_PAGE_ID` заагаагүй байж болно (хуучин
       суулгацад байхгүй) тул зөвхөн утгатай үед л тулгана. */
    const mainId = process.env[`${px}FB_PAGE_ID`];
    if (mainId && pageId === mainId) return main;

    /* ⚠️ IG нь эцэг page-ийн токеноор — `IG_USER_ID` тааралдвал үндсэн.
       Хэрэв IG нь өөр хуудсанд харьяалагдвал `FB_PAGE_ID_N`-ээр дарж
       бичигдэнэ (доорх давталт ЭХЭЛЖ шалгагдана). */
    for (let i = 2; i <= 20; i += 1) {
      const id = process.env[`${px}FB_PAGE_ID_${i}`];
      const token = process.env[`${px}FB_PAGE_ACCESS_TOKEN_${i}`];
      if (id && token && pageId === id) return token;
    }

    const igId = process.env[`${px}IG_USER_ID`];
    if (igId && pageId === igId) return main;

    /**
     * ⚠️⚠️ ТААРААГҮЙ `pageId` — ҮНДСЭН ТОКЕН РУУ УНАХГҮЙ.
     *
     * ⛔ БОДИТ ЭРСДЭЛ: сайт нь ОЛОН хуудастай үед (BestFilm-д 2,
     *    BestTV-д 3) таараагүй id-д `main` буцаавал админы хариу
     *    БУРУУ ХУУДСААР явна — хэрэглэгч огт бичээгүй хуудаснаас
     *    зурвас авна, брэндийн нэрийн өмнөөс.
     *
     * ⚠️ Зөвхөн НЭГ хуудас тохируулсан үед (`FB_PAGE_ID` заагаагүй
     *    хуучин суулгац) `main`-ыг хэвээр буцаана — эс бөгөөс BestTV-
     *    ийн одоогийн ажиллагаа тасарна.
     */
    const anyIdConfigured =
      !!process.env[`${px}FB_PAGE_ID`] || !!process.env[`${px}FB_PAGE_ID_2`];
    if (anyIdConfigured) {
      this.logger.error(
        `⛔ FB pageId=${pageId} нь ${currentSite()}-ийн аль ч хуудастай ` +
          'таарсангүй — админы хариу ИЛГЭЭГДСЭНГҮЙ (буруу хуудсаар ' +
          'явахаас сэргийлэв). Токеныг .env-д нэмнэ үү.',
      );
      return undefined;
    }
    return main;
  }

  /**
   * userId бодитоор оршиж байгаа эсэх — FK алдаанаас сэргийлнэ.
   *
   * ⚠️⚠️ `site` ЗААВАЛ — эс бөгөөс сайтын шүүлт FAIL-OPEN.
   *
   * ⛔ БОДИТ АЛДАА (2026-09-10 аудит): `select: { id }` тул
   *    `site-extension`-ийн post-filter (`'site' in row`) алгасагдаж,
   *    НӨГӨӨ САЙТЫН `userId`-г «хүчинтэй» гэж үзэж байв. Үр дүнд
   *    чат зурвас буруу сайтын хэрэглэгчид холбогдож, тэр хүн
   *    өөрийн профайлаас танихгүй яриа хардаг болно.
   */
  private async safeUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const u = await this.prisma.user
      .findUnique({ where: { id: userId }, select: { id: true, site: true } })
      .catch(() => null);
    return u?.id;
  }

  async saveMessage(input: SaveMessageInput) {
    const sessionId = (input.sessionId ?? '').trim().slice(0, 64);
    const text = (input.text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    const role = ALLOWED_ROLES.has(input.role) ? input.role : 'user';
    const channel = ALLOWED_CHANNELS.has(input.channel ?? '') ? input.channel! : 'web';
    /* ⚠️ ЗӨВХӨН тоон id — дурын мөр DB рүү орохоос сэргийлнэ */
    const pageId = /^[0-9]{5,25}$/.test(input.pageId ?? '') ? input.pageId! : undefined;

    /**
     * ⚠️⚠️ КАРТУУДЫГ ЗААВАЛ ЦЭВЭРЛЭНЭ — тоо БА талбарын урт хоёуланг.
     *
     * Зөвхөн тоог таслах нь хангалтгүй: 20 картын `title` талбар бүрт
     * 500KB бичвэл дахин 10MB болно. Тиймээс талбар бүрийг ч таслана.
     */
    const titles = (Array.isArray(input.titles) ? input.titles : [])
      .slice(0, MAX_TITLE_CARDS)
      .map((t) => ({
        id: String(t?.id ?? '').slice(0, MAX_CARD_FIELD),
        title: String(t?.title ?? '').slice(0, MAX_CARD_FIELD),
        slug: String(t?.slug ?? '').slice(0, MAX_CARD_FIELD),
        ...(t?.posterUrl ? { posterUrl: String(t.posterUrl).slice(0, MAX_CARD_FIELD) } : {}),
        ...(t?.backdropUrl ? { backdropUrl: String(t.backdropUrl).slice(0, MAX_CARD_FIELD) } : {}),
        ...(t?.subtitle ? { subtitle: String(t.subtitle).slice(0, MAX_CARD_FIELD) } : {}),
      }))
      .filter((t) => t.id && t.slug);

    if (!sessionId || !text) return { ok: true, skipped: true };

    try {
      // Хэрэглэгчийн бичсэн текстээс имэйл автоматаар таана (холбоо барих)
      let capturedEmail: string | undefined;
      if (role === 'user') {
        const m = text.match(EMAIL_RE);
        if (m) capturedEmail = m[0].toLowerCase();
      }

      /**
       * ⚠️⚠️ АДМИН АВСАН ЯРИА РУУ AI МЕССЕЖ ОРУУЛАХГҮЙ.
       *
       * `/chat/ingest` нь НЭЭЛТТЭЙ endpoint (n8n-д зориулсан). n8n
       * талд `Check Handoff` шалгалт байгаа ч тэр нь ГАНЦ давхарга —
       * хэн ч шууд POST хийж админ хариулж буй яриа руу «assistant»
       * мессеж шахаж, хэрэглэгчийг төөрөлдүүлж болно.
       *
       * ⚠️ Хэрэглэгчийн мессежийг ХАДГАЛНА — админ юу асуусныг нь
       * харах ёстой. Зөвхөн AI-ийнхыг таслана.
       */
      if (role === 'assistant') {
        const conv = await this.prisma.chatConversation
          .findUnique({
            /* ⚠️ composite түлхүүр — дээрх `upsert`-тэй ижил шалтгаан */
            where: { sessionId_site: { sessionId, site: currentSite() } },
            select: { handedOff: true },
          })
          .catch(() => null);
        if (conv?.handedOff) {
          this.logger.log(`Handoff идэвхтэй — AI мессеж алгаслаа (${sessionId})`);
          return { ok: true, skipped: true };
        }
      }

      const safeUserId = await this.safeUserId(input.userId);
      const now = new Date();
      const markAdminUnread = role === 'user';

      const conversation = await this.prisma.chatConversation.upsert({
        /**
         * ⚠️⚠️ `sessionId_site` — глобал `sessionId` БИШ.
         *
         * `site-extension` нь `upsert`-ийн `where`-д сайтын шүүлт
         * НЭМДЭГГҮЙ (unique түлхүүр эвдэрнэ) тул түлхүүр өөрөө сайтыг
         * агуулах ёстой. Эс бөгөөс BestFilm-ийн зочин BestTV-д байгаа
         * `sessionId` илгээвэл шинэ мөр үүсэхгүй, BestTV-ийн ярианы
         * `update` салаа ажиллаж зурвас нь буруу сайтын админд очно.
         */
        where: { sessionId_site: { sessionId, site: currentSite() } },
        create: {
          channel,
          ...(pageId ? { pageId } : {}),
          sessionId,
          lastMessageAt: now,
          adminUnread: markAdminUnread,
          ...(input.userName ? { userName: input.userName.slice(0, 300) } : {}),
          ...(input.userImage ? { userImage: input.userImage.slice(0, 2048) } : {}),
          ...(capturedEmail ? { userEmail: capturedEmail } : {}),
          ...(safeUserId ? { userId: safeUserId } : {}),
        },
        update: {
          lastMessageAt: now,
          /* ⚠️ ХУУЧИН яриаг ч нөхнө — засвараас өмнөх бичлэгүүд
             `pageId`-гүй үлдсэн тул дараагийн мессежээр бөглөгдөнө */
          ...(pageId ? { pageId } : {}),
          ...(markAdminUnread ? { adminUnread: true } : {}),
          ...(input.userName ? { userName: input.userName.slice(0, 300) } : {}),
          /**
           * ⚠️ Зураг бүрд дахин бичнэ — FB URL хугацаатай тул
           * шинэчилж байж амьд үлдэнэ.
           *
           * ⚠️⚠️ ХЯЗГААР нь ЗӨВХӨН хамгаалалт — DB талбар `text`
           * тул Postgres талд хязгаар БАЙХГҮЙ. Гэвч `/chat/ingest`
           * нь нээлттэй endpoint тул хортой хүсэлт 10 MB мөр
           * илгээж DB дүүргэхээс сэргийлнэ.
           *
           * ⚠️ 2048 — бодит датанаас 4 дахин өндөр. 500 байсан нь
           * ХЭТ БАГА: Instagram-ийн `profile_pic` signed URL нь
           * 525 тэмдэгт хүрдэг тул таслагдаж, гарын үсэг эвдэрч
           * 403 Forbidden болно. Админ панелд аватарын оронд
           * эхний үсэг гардаг байсан шалтгаан нь ЭНЭ.
           */
          ...(input.userImage ? { userImage: input.userImage.slice(0, 2048) } : {}),
          ...(capturedEmail ? { userEmail: capturedEmail } : {}),
          ...(safeUserId ? { userId: safeUserId } : {}),
        },
        select: { id: true },
      });

      /* ⚠️ Хавсралтыг R2 руу хуулна — Meta-гийн URL хугацаатай */
      const att = await this.saveAttachment(input.attachmentUrl, input.attachmentType);

      /**
       * ⚠️⚠️ ХОЛБООСЫН OG КАРТ — НЭГ ГАЗАР, ГУРВАН СУВАГТ.
       *
       * Хариунд besttv.us линк орвол OG-г ЭНД нэг удаа татаад
       * хадгална. Вэб чат, админ панель, FB/IG гурвуулаа энэ нэг
       * талбараас уншина — тус тусад нь татвал зөрөх, давхардах,
       * нэгийг зассан алдаа нөгөөд үлдэх эрсдэлтэй.
       *
       * ⚠️ ЗӨВХӨН кино карт БАЙХГҮЙ үед — кино нь илүү мэдээлэлтэй,
       *    хоёулаа гарвал нэг мессежид хоёр том блок болно.
       * ⚠️ Хэрэглэгчийн мессежид ХИЙХГҮЙ — зөвхөн бот/админы хариунд.
       */
      const linkPreview =
        !input.titles?.length && role !== 'user'
          ? await this.preview.fromText(text)
          : null;

      const message = await this.prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role,
          text,
          ...(titles.length ? { titles: titles as unknown as object } : {}),
          ...(linkPreview ? { linkPreview: linkPreview as object } : {}),
          ...(att ? { attachmentKey: att.key, attachmentType: att.type } : {}),
        },
      });

      /* ⚠️ `linkPreview`-г буцаана — n8n нь widget рүү дамжуулна */
      return { ok: true, conversationId: conversation.id, messageId: message.id, linkPreview };
    } catch (err) {
      this.logger.warn(`Чат хадгалахад алдаа: ${(err as Error).message}`);
      return { ok: true, skipped: true };
    }
  }

  /**
   * FB/IG хавсралтыг R2 руу хуулна.
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: Meta-гийн CDN URL (`lookaside.fbsbx.com`)
   * нь signed бөгөөс хэдэн цаг/өдрийн дараа 403 болно. Дансаар
   * шилжүүлсэн БАРИМТЫН ЗУРАГ алга болвол маргаан гарахад нотлох
   * баримтгүй үлдэнэ — мөнгөний асуудал тул энэ нь ноцтой.
   *
   * ⚠️ Алдаа ХЭЗЭЭ Ч шидэхгүй — зураг алдагдсан ч чат хадгалагдана.
   */
  private async saveAttachment(
    url?: string,
    type?: string,
  ): Promise<{ key: string; type: string } | null> {
    if (!url) return null;

    /**
     * ⚠️⚠️ SSRF ХАМГААЛАЛТ — `/chat/ingest` НЭЭЛТТЭЙ endpoint.
     *
     * Хэн ч дурын URL илгээж болно. Хамгаалалтгүй бол halдлагч
     * `http://169.254.169.254/` (cloud metadata), `http://redis:6379`,
     * `http://besttv-postgres:5432` зэрэг ДОТООД хаяг руу backend-ээр
     * хүсэлт явуулж, хариуг R2-д хадгалуулж уншиж чадна.
     *
     * ⚠️ Зөвхөн Meta-гийн CDN домэйныг зөвшөөрнө — хавсралт өөр
     * газраас ирэх ёсгүй.
     */
    let host: string;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return null;
      host = u.hostname.toLowerCase();
    } catch {
      return null;
    }
    const ALLOWED = ['fbcdn.net', 'fbsbx.com', 'cdninstagram.com', 'facebook.com'];
    if (!ALLOWED.some((d) => host === d || host.endsWith('.' + d))) {
      this.logger.warn(`Хавсралтын домэйн зөвшөөрөгдөөгүй: ${host}`);
      return null;
    }

    const kind = type === 'video' || type === 'file' ? type : 'image';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        this.logger.warn(`Хавсралт татаж чадсангүй (${res.status})`);
        return null;
      }
      /* ⚠️ Хэмжээ шалгана — том файл санах ойг дүүргэнэ */
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > MAX_ATTACHMENT_BYTES) {
        this.logger.warn(`Хавсралт хэт том (${Math.round(len / 1024 / 1024)}MB) — алгаслаа`);
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_ATTACHMENT_BYTES) return null;

      const ct = res.headers.get('content-type') ?? 'application/octet-stream';
      /* Өргөтгөлийг content-type-аас — Meta URL-д өргөтгөл байдаггүй */
      const ext = ct.includes('png')
        ? 'png'
        : ct.includes('webp')
          ? 'webp'
          : ct.includes('gif')
            ? 'gif'
            : ct.includes('pdf')
              ? 'pdf'
              : ct.includes('mp4')
                ? 'mp4'
                : 'jpg';
      const key = `images/chat/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
      await this.storage.upload(key, buf, ct);
      this.logger.log(`Чатын хавсралт хадгалав: ${key} (${Math.round(buf.byteLength / 1024)}KB)`);
      return { key, type: kind };
    } catch (e) {
      this.logger.warn(`Хавсралт хадгалахад алдаа: ${(e as Error).message}`);
      return null;
    }
  }

  /** Нэвтрэх үед зочны яриаг хэрэглэгчид холбоно (backfill) */
  async linkSession(sessionId: string, userId: string) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { ok: true, linked: 0 };
    const safe = await this.safeUserId(userId);
    if (!safe) return { ok: true, linked: 0 };

    // ⚠️ OR нөхцөл — өөр хэрэглэгчийн session-ыг булаахаас сэргийлнэ
    const res = await this.prisma.chatConversation
      .updateMany({
        where: { sessionId: sid, OR: [{ userId: null }, { userId: safe }] },
        data: { userId: safe },
      })
      .catch(() => null);

    return { ok: true, linked: res?.count ?? 0 };
  }

  /** Хэрэглэгчийн polling — админы шинэ хариу авах */
  /**
   * @param meId — нэвтэрсэн хэрэглэгчийн id (token-оос). Зочин бол null.
   */
  async getMessagesForUser(sessionId: string, after?: string, meId?: string | null) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { handedOff: false, messages: [] };

    const conv = await this.prisma.chatConversation
      .findUnique({
        /* ⚠️ composite түлхүүр — сайт бүрд өөрийн яриа */
        where: { sessionId_site: { sessionId: sid, site: currentSite() } },
        select: { id: true, handedOff: true, userUnreadCount: true, userId: true },
      })
      .catch(() => null);
    if (!conv) return { handedOff: false, messages: [] };

    /**
     * ⚠️⚠️ ЭЗЭМШЛИЙН ШАЛГАЛТ — БУСДЫН ЯРИА УНШИХААС хамгаална.
     *
     * `sessionId` нь localStorage-д хадгалагддаг бөгөөд лог, Referer,
     * дэлгэцийн зураг зэргээр задарч болно. Урьд нь шалгалт ОГТ
     * байгаагүй тул мэдсэн хүн ярианы БҮХ мессежийг (мөн ярианаас
     * автоматаар салгасан ИМЭЙЛ) уншиж чаддаг байв.
     *
     * ⚠️ Яриа хэрэглэгчид ХОЛБОГДСОН (`userId != null`) байвал ЗӨВХӨН
     * тэр хүн уншина. Зочны яриа (`userId == null`) нь sessionId-аараа
     * л хамгаалагдана — тэнд нэвтрэлт байхгүй тул өөр арга байхгүй.
     */
    if (conv.userId && conv.userId !== meId) {
      return { handedOff: false, messages: [] };
    }

    const afterDate = after ? new Date(after) : undefined;
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: conv.id,
        ...(afterDate && !isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, role: true, text: true, titles: true, linkPreview: true, createdAt: true },
    });

    // Админы мессежийг хэрэглэгч харсан тул тоолуур тэглэнэ
    if (conv.userUnreadCount > 0 && messages.some((m) => m.role === 'admin')) {
      await this.prisma.chatConversation
        .update({ where: { id: conv.id }, data: { userUnreadCount: 0 } })
        .catch(() => null);
    }

    return { handedOff: conv.handedOff, messages };
  }

  async getUnreadForUser(sessionId: string, meId?: string | null) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { unread: 0, handedOff: false };
    const conv = await this.prisma.chatConversation
      .findUnique({
        /* ⚠️ composite түлхүүр — сайт бүрд өөрийн яриа */
        where: { sessionId_site: { sessionId: sid, site: currentSite() } },
        select: { userUnreadCount: true, handedOff: true, userId: true },
      })
      .catch(() => null);
    /* ⚠️ `getMessagesForUser`-тэй ижил эзэмшлийн шалгалт */
    if (conv?.userId && conv.userId !== meId) return { unread: 0, handedOff: false };
    return { unread: conv?.userUnreadCount ?? 0, handedOff: conv?.handedOff ?? false };
  }

  // ─── Админ ────────────────────────────────────────────────────────────────

  async listConversations(opts: {
    page?: number;
    pageSize?: number;
    onlyUnread?: boolean;
    /** ⚠️ Зөвхөн ТЭМДЭГЛЭСЭН яриа — админы «дараа хариулах» жагсаалт */
    onlyStarred?: boolean;
    q?: string;
    channel?: string;
    /* ⚠️ FB page-ээр шүүх — олон page-тэй үед (Best TV / Best Tv 2) */
    pageId?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

    /**
     * ⚠️⚠️ ХАЙЛТ — өмнө нь ОГТ БАЙГААГҮЙ.
     *
     * `pageSize` дээд тал нь 50 тул 51 дэх яриа руу хүрэх ямар ч арга
     * байхгүй байв (хуудаслалт ч админ талд байхгүй). Хэрэглэгч
     * "миний бичсэн зурвасыг хараарай" гэж залгахад тэр яриаг ОЛОХ
     * боломжгүй — тусламжийн ажил бүтэхгүй.
     *
     * ⚠️ Имэйл/нэрээс ГАДНА мессежийн агуулгаар ч хайна — зочин
     * хэрэглэгч (userId = null) нь имэйлгүй тул зөвхөн бичсэн
     * зурвасаараа л олдоно.
     */
    const needle = opts.q?.trim();
    /**
     * ⚠️ Сувгийн шүүлт — FB/IG чатбот ажиллаж эхэлмэгц вэбийн яриатай
     * холилдоно. «Facebook-ээс ирсэн хариулаагүй зурвасууд» гэсэн
     * ажлын урсгал шүүлтгүйгээр боломжгүй.
     *
     * ⚠️ Зөвшөөрөгдсөн утгыг л авна — дурын текст шидвэл хоосон
     * жагсаалт буцаж, админ «яриа алга болсон» гэж бодно.
     */
    const channel =
      opts.channel && ALLOWED_CHANNELS.has(opts.channel) ? opts.channel : undefined;
    const where: Prisma.ChatConversationWhereInput = {
      ...(opts.onlyUnread ? { adminUnread: true } : {}),
      ...(opts.onlyStarred ? { starred: true } : {}),
      ...(channel ? { channel } : {}),
      /* ⚠️ Зөвхөн тоон id — дурын мөр DB асуулгад орохгүй */
      ...(/^[0-9]{5,25}$/.test(opts.pageId ?? '') ? { pageId: opts.pageId } : {}),
      ...(needle
        ? {
            OR: [
              { user: { email: { contains: needle, mode: 'insensitive' } } },
              { user: { name: { contains: needle, mode: 'insensitive' } } },
              { messages: { some: { text: { contains: needle, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [items, total, unreadTotal, starredTotal, byChannel, byPage] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true, avatarKey: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, role: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.count({ where: { adminUnread: true } }),
      /**
       * ⚠️ ТЭМДЭГЛЭСЭН ярианы тоо — шүүлтийн товч дээр харуулна.
       *
       * `where`-ЭЭС ХАМААРАХГҮЙ (бүх тэмдэглэсний бодит тоо) —
       * сувгийн тоололтой ижил зарчим. Эс бөгөөс FB таб дээр
       * байхад «Тэмдэглэсэн 0» гэж харагдаж, админ бүх тэмдэглэлээ
       * алдсан гэж эндүүрнэ.
       */
      this.prisma.chatConversation.count({ where: { starred: true } }),
      /**
       * ⚠️ Суваг тус бүрийн тоо — шүүлтийн товч дээр «FB 12» гэж
       * харуулна. Тоогүй бол админ хоосон табыг дарж шалгах хэрэгтэй
       * болно. `where`-ээс ХАМААРАХГҮЙ (бүх сувгийн бодит тоо).
       */
      this.prisma.chatConversation.groupBy({
        by: ['channel'],
        _count: { _all: true },
      }),
      /**
       * ⚠️⚠️ PAGE ТУС БҮРИЙН ТОО — ХОЁР Facebook page-тэй.
       *
       * Админ «Best Tv 2 руу хэдэн зурвас ирсэн» гэдгийг мэдэхгүй бол
       * шүүлтийн товч дарж шалгах хэрэгтэй болно. Тоо нь шууд харагдвал
       * ажлын урсгал хурдасна (сувгийн тоололтой ижил зарчим).
       *
       * ⚠️  NULL-ыг алгасна — вэб чат болон хуучин яриа.
       */
      this.prisma.chatConversation.groupBy({
        by: ['pageId'],
        where: { pageId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const channelCounts: Record<string, number> = {};
    for (const row of byChannel) channelCounts[row.channel] = row._count._all;

    /* ⚠️ Page тус бүрийн тоо — админ шүүлтийн товчинд харуулна */
    const pageCounts: Record<string, number> = {};
    for (const row of byPage) if (row.pageId) pageCounts[row.pageId] = row._count._all;

    /**
     * ⚠️⚠️ БҮРТГЭЛТЭЙ ХЭРЭГЛЭГЧИЙН АВАТАР — `avatarKey` нь R2-ийн KEY,
     * browser шууд ачаалж ЧАДАХГҮЙ. Өмнө нь татагддаг байсан ч URL
     * болгодоггүй, UI-д ч ашиглагддаггүй байв — зөвхөн FB/IG-ийн
     * `userImage` харагддаг тул манай сайтаар бүртгүүлсэн хүн үргэлж
     * нэрийн эхний үсгээр л харагддаг байсан (админы хүсэлт).
     *
     * ⚠️ Багцаар presign — мөр бүрд await хийвэл 30 ярианд 30
     * дараалсан дуудалт болно.
     */
    const avatarUrls = await Promise.all(
      items.map((c) =>
        c.user?.avatarKey
          ? this.storage.publicAssetUrl(c.user.avatarKey, 7200).catch(() => null)
          : Promise.resolve(null),
      ),
    );
    const withAvatars = items.map((c, i) => ({
      ...c,
      /**
       * ⚠️ ЭРЭМБЭ: FB/IG-ийн профайл зураг ДАВУУ — тэр нь тухайн
       * сувгийн бодит нүүр. Байхгүй бол манай сайтын аватар.
       */
      userImage: c.userImage ?? avatarUrls[i],
      /* ⚠️ Нэргүй FB/IG чатад таних тэмдэг — «Зочин» давхардахгүй */
      userName: this.displayName(c),
    }));

    /* ⚠️ `totalPages` — админы `<Pagination>` энэ талбарыг шаардана */
    return {
      items: withAvatars,
      total,
      unreadTotal,
      starredTotal,
      channelCounts,
      pageCounts,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * ⚠️⚠️ FB/IG ХЭРЭГЛЭГЧИЙН ТАНИХ ТЭМДЭГ — «Зочин» гэж бүгд ижил
   * харагдахаас сэргийлнэ.
   *
   * БОДИТ АСУУДАЛ: Messenger-ээс ирсэн 8 чатаас 7 нь нэргүй тул
   * админ панел дээр бүгд «Зочин» гэж харагддаг — аль нь хэн болох
   * нь ялгагдахгүй, өмнөх яриаг ч холбож чадахгүй.
   *
   * ШАЛТГААН (судалгаагаар): Meta-гийн `Business Asset User Profile
   * Access` FEATURE нь App Review-д батлагдаагүй. Батлагдаагүй
   * feature нь ЗӨВХӨН App дээр role-той хүнд (Admin/Tester)
   * ажилладаг тул бодит хэрэглэгчид код 100/33 буцаана.
   * Эрх ирэх хүртэл (App Review ~20 хоног) энэ fallback хэрэгтэй.
   *
   * ⚠️ Нэр ОЛДСОН бол түүнийг ҮРГЭЛЖ давуу — fallback нь зөвхөн
   * NULL үед.
   */
  private displayName(c: {
    channel: string;
    sessionId: string;
    userName: string | null;
    user?: { name: string | null; email: string } | null;
  }): string | null {
    if (c.user?.name) return c.user.name;
    if (c.userName) return c.userName;
    if (c.user?.email) return c.user.email;

    /* ⚠️ Зөвхөн FB/IG-д — вэб зочин нь `sessionId` нь утгагүй hash */
    if (c.channel === 'web') return null;

    /**
     * PSID-ийн сүүлийн 4 орон — тогтмол, товч, ялгаатай.
     * «Messenger #7547» гэх мэт. Chatwoot, Re:amaze зэрэг бодит
     * бүтээгдэхүүнүүд ижил аргыг хэрэглэдэг.
     */
    const tail = c.sessionId.slice(-4);
    const label = c.channel === 'instagram' ? 'Instagram' : 'Messenger';
    return `${label} #${tail}`;
  }

  async getConversation(id: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      include: {
        user: { select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, id: true, name: true, email: true, avatarKey: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: {
            id: true, role: true, text: true, titles: true, linkPreview: true, createdAt: true,
            attachmentKey: true, attachmentType: true,
          },
        },
      },
    });
    if (!conv) return null;

    if (conv.adminUnread) {
      await this.prisma.chatConversation
        .update({ where: { id }, data: { adminUnread: false } })
        .catch(() => null);
    }

    /**
     * ⚠️ Хавсралтын R2 key → үзэх боломжтой URL.
     *
     * Админ баримтын зургийг ЭНД харах ёстой — Meta Inbox руу орох
     * шаардлагагүй. Дансаар төлсөн эсэхийг шалгах гол ажил.
     */
    const messages = await Promise.all(
      conv.messages.map(async (m) => ({
        ...m,
        attachmentUrl: m.attachmentKey
          ? await this.storage.publicAssetUrl(m.attachmentKey).catch(() => '')
          : undefined,
      })),
    );

    /**
     * ⚠️ Хэрэглэгчийн БАГЦ — «энэ хүн төлбөртэй юу?» гэдгийг админ
     * мэдэхгүй бол дансаар төлсөн гомдол шийдэх боломжгүй.
     */
    const subs = conv.userId
      ? await this.prisma.subscription
          .findMany({
            where: { userId: conv.userId, expiresAt: { gt: new Date() } },
            select: { expiresAt: true, plan: { select: { name: true, isVip: true } } },
            orderBy: { expiresAt: 'desc' },
            take: 5,
          })
          .catch(() => [])
      : [];

    /**
     * ⚠️ Ярианы ТОЛГОЙД ч аватар — админ хэнтэй ярьж буйгаа нүүрээр
     * таана. FB/IG профайл зураг ДАВУУ (сувгийн бодит нүүр), байхгүй
     * бол манай сайтын аватар.
     */
    const userImage =
      conv.userImage ??
      (conv.user?.avatarKey
        ? await this.storage.publicAssetUrl(conv.user.avatarKey, 7200).catch(() => null)
        : null);

    return {
      ...conv,
      userImage,
      /* ⚠️ Жагсаалттай ИЖИЛ таних тэмдэг — хоёр дэлгэц зөрөх ёсгүй */
      userName: this.displayName(conv),
      messages,
      subscriptions: subs,
    };
  }

  /** Админ гар аргаар хариулах */
  async adminReply(id: string, text: string) {
    const t = (text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    if (!t) return { ok: false as const };

    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      /* ⚠️ `pageId` ЗААВАЛ — хоёр FB page-тэй тул админы хариу
         ЯГ ТЭР page-ийн токеноор явах ёстой */
      select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, id: true, userId: true, sessionId: true, channel: true, pageId: true },
    });
    if (!conv) return { ok: false as const };

    const message = await this.prisma.chatMessage.create({
      data: { conversationId: id, role: 'admin', text: t },
      select: { id: true, role: true, text: true, createdAt: true },
    });

    await this.prisma.chatConversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        adminUnread: false,
        userUnreadCount: { increment: 1 },
      },
    });

    /**
     * ⚠️⚠️ FB/IG-д хариуг MESSENGER РҮҮ илгээнэ.
     *
     * Вэбийн хэрэглэгч сайт руугаа орж хариуг харна. Гэтэл Facebook/
     * Instagram-аас бичсэн хүн МАНАЙ САЙТ РУУ ОРДОГГҮЙ — DB-д бичээд
     * орхивол админы хариу хэнд ч хүрэхгүй, хэрэглэгч хариу аваагүй
     * гэж бодоод орхино.
     *
     * ⚠️ Алдаа гарвал ШИДЭХГҮЙ — админд «илгээгдлээ» гэж харагдсан
     * атлаа DB-д хадгалагдахгүй байх нь илүү муу. Оронд нь буцаах
     * утганд `delivered` талбараар мэдэгдэнэ.
     */
    let delivered: boolean | undefined;
    if (conv.channel === 'facebook' || conv.channel === 'instagram') {
      /* ⚠️ `pageId` ЗААВАЛ — Best Tv 2-д өөр токен хэрэгтэй */
      delivered = await this.sendToMessenger(conv.sessionId, t, conv.pageId);
    }

    return { ok: true as const, message, userId: conv.userId, delivered };
  }

  /**
   * Facebook/Instagram Messenger руу текст илгээнэ.
   *
   * ⚠️ `sessionId` нь FB/IG-ийн PSID (n8n тэрийг sessionId болгож бичдэг).
   * ⚠️ Token байхгүй бол чимээгүй унтрахгүй — ЛОГ бичнэ, эс бөгөөс
   *    админ хариу явахгүй байгааг мэдэхгүй.
   */
  private async sendToMessenger(
    psid: string,
    text: string,
    pageId?: string | null,
  ): Promise<boolean> {
    /* ⚠️ Тухайн page-ийн токен — өөр page-ийнхээр илгээвэл Meta
       `(#100) No matching user found` буцааж, зурвас ХҮРЭХГҮЙ */
    const token = this.pageToken(pageId);
    if (!token) {
      this.logger.error(
        'FB_PAGE_ACCESS_TOKEN тохируулаагүй — админы хариу Messenger рүү ИЛГЭЭГДСЭНГҮЙ',
      );
      return false;
    }
    /* Нэг илгээлт — tag-тай эсвэл tag-гүй */
    const post = (tag?: string) =>
      fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text: text.slice(0, 1900) },
          ...(tag
            ? { messaging_type: 'MESSAGE_TAG', tag }
            : { messaging_type: 'RESPONSE' }),
        }),
        signal: AbortSignal.timeout(10_000),
      });

    try {
      let res = await post();

      /**
       * ⚠️⚠️ 24 ЦАГИЙН ЦОНХ ХААГДСАН БОЛ `HUMAN_AGENT` TAG-ААР ДАХИН.
       *
       * Meta-гийн дүрмээр хэрэглэгч сүүлд бичсэнээс хойш 24 цаг
       * өнгөрвөл энгийн мессеж илгээхийг хориглоно (#10 / 2018278).
       *
       * ⚠️ BestTV-д энэ нь БОДИТ асуудал: хэрэглэгч амралтын өдөр
       * дансаар төлж баримт илгээдэг, админ даваа гарагт шалгадаг —
       * тэр үед 24 цаг аль хэдийн өнгөрсөн байна. Хариу явахгүй бол
       * мөнгө төлсөн хүн хариу хүлээсээр үлдэнэ.
       *
       * `HUMAN_AGENT` tag нь хүний оператор хариулж байгааг Meta-д
       * мэдэгдэж, цонхыг **7 хоног** болгож сунгана.
       *
       * ⚠️ Эхлээд `RESPONSE` оролдоно — tag-ийг зөвхөн ШААРДЛАГАТАЙ
       * үед хэрэглэнэ (Meta хэт олон tag ашиглалтыг шалгадаг).
       */
      if (!res.ok) {
        const peek = await res.clone().text().catch(() => '');
        if (peek.includes('2018278') || peek.includes('outside of allowed window')) {
          this.logger.log('24 цагийн цонх хаагдсан — HUMAN_AGENT tag-аар дахин илгээж байна');
          res = await post('HUMAN_AGENT');
        }
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Messenger илгээлт амжилтгүй (${res.status}): ${body.slice(0, 300)}`);

        /**
         * ⚠️⚠️ TOKEN ҮХСЭНИЙГ TELEGRAM-ААР МЭДЭГДЭНЭ.
         *
         * Page token хүчингүй болбол (солигдох, устгах, эрх хасагдах)
         * чатбот БҮХЭЛДЭЭ чимээгүй үхнэ — хэрэглэгчид хариу авахгүй,
         * админ ч мэдэхгүй. Зөвхөн лог бичих нь хангалтгүй: хэн ч
         * контейнерийн лог өдөр бүр уншдаггүй.
         *
         * ⚠️ ЗӨВХӨН token/эрхийн алдаанд (190, 200, 10, 3) —
         * 24 цагийн цонх (#10 subcode 2018278) нь ЭНГИЙН зүйл тул
         * түүнд сэрэмжлүүлбэл спам болно.
         */
        try {
          const j = JSON.parse(body) as { error?: { code?: number; error_subcode?: number } };
          const code = j?.error?.code;
          const sub = j?.error?.error_subcode;
          const isTokenDead = code === 190 || code === 200 || code === 3;
          if (isTokenDead && sub !== 2018278) {
            this.n8n.emitAlert({
              level: 'critical',
              title: 'Facebook token хүчингүй',
              message:
                `Messenger илгээлт #${code} алдаагаар унав. Page token солих шаардлагатай — ` +
                'чатбот болон админы хариу ажиллахгүй байна.',
              source: 'chat.sendToMessenger',
            });
          }
        } catch {
          /* JSON биш хариу — лог хангалттай */
        }
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Messenger илгээлт алдаа: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * n8n-д зориулсан ХӨНГӨН төлөв шалгалт.
   *
   * ⚠️ Яриа хараахан үүсээгүй (анхны мессеж) бол `handedOff: false` —
   * шинэ хэрэглэгчид AI хариулах ёстой.
   */
  async sessionState(sessionId: string): Promise<{ handedOff: boolean; exists: boolean }> {
    if (!sessionId) return { handedOff: false, exists: false };
    const conv = await this.prisma.chatConversation
      .findUnique({
        /* ⚠️ composite түлхүүр — сайт бүрд өөрийн яриа */
        where: { sessionId_site: { sessionId, site: currentSite() } },
        select: { handedOff: true },
      })
      .catch(() => null);
    return { handedOff: conv?.handedOff ?? false, exists: !!conv };
  }

  /** AI-г унтраах / буцааж асаах */
  async setHandoff(id: string, handedOff: boolean) {
    await this.prisma.chatConversation
      .update({
        where: { id },
        data: { handedOff, ...(handedOff ? { adminUnread: false } : {}) },
      })
      .catch(() => null);
    return { ok: true, handedOff };
  }

  /**
   * Яриаг ТЭМДЭГЛЭХ / тайлах (одтой болгох).
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ: 316 яриа дунд чухал нь (гомдол, төлбөрийн
   * маргаан, дараа эргэж хариулах ёстой) алга болдог. Хайлтаар дахин
   * олох гэхээр админ хэн юу бичсэнийг санахгүй.
   *
   * ⚠️ `adminUnread`-ААС ТУСДАА: «уншаагүй» нь нээмэгц АВТОМАТААР
   *    арилдаг, «тэмдэглэсэн» нь админ өөрөө тайлтал үлдэнэ.
   *
   * ⚠️ `starredAt` — тайлахад NULL болгоно. Эс бөгөөс дахин
   *    тэмдэглэхэд хуучин огноогоор эрэмбэлэгдэж, шинэ тэмдэглэл
   *    жагсаалтын доод талд алга болно.
   */
  async setStarred(id: string, starred: boolean) {
    await this.prisma.chatConversation
      .update({
        where: { id },
        data: { starred, starredAt: starred ? new Date() : null },
      })
      .catch(() => null);
    return { ok: true, starred };
  }

  /** Олон яриаг нэг дор тэмдэглэх/тайлах (жагсаалтын bulk сонголт) */
  async bulkStar(ids: string[], starred: boolean) {
    if (!ids.length) return { updated: 0 };
    const res = await this.prisma.chatConversation.updateMany({
      where: { id: { in: ids } },
      data: { starred, starredAt: starred ? new Date() : null },
    });
    return { updated: res.count, starred };
  }

  /**
   * Олон яриаг нэг дор устгана (админ — тест яриа цэвэрлэх).
   *
   * ⚠️ `ChatMessage` нь `onDelete: Cascade` тул мессежүүд нь ДАГАЖ
   * устана — тусад нь устгах шаардлагагүй.
   */
  /**
   * Олон яриаг нэг дор устгана (админ — тест яриа цэвэрлэх).
   *
   * ⚠️ `ChatMessage` нь `onDelete: Cascade` тул мессежүүд нь ДАГАЖ устана —
   * тусад нь устгах шаардлагагүй.
   */
  async bulkDelete(ids: string[]) {
    if (!ids.length) return { deleted: 0 };
    const res = await this.prisma.chatConversation.deleteMany({
      where: { id: { in: ids } },
    });
    return { deleted: res.count };
  }

  /**
   * Яриаг «уншсан» болгох.
   *
   * ⚠️ `ids` өгвөл ЗӨВХӨН тэднийг, эс бөгөөс уншаагүй БҮГДИЙГ.
   * Аль хэдийн уншсаныг дахин бичихгүй (`adminUnread: true` шүүлт).
   */
  async markRead(ids?: string[]) {
    const res = await this.prisma.chatConversation.updateMany({
      where: {
        adminUnread: true,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { adminUnread: false },
    });
    return { updated: res.count };
  }

  async unreadCount() {
    const unreadTotal = await this.prisma.chatConversation.count({ where: { adminUnread: true } });
    return { unreadTotal };
  }
}
