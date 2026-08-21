import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** n8n-ээс ирэх санал болгосон кино */
export interface ChatTitleCard {
  id: string;
  title: string;
  slug: string;
  posterUrl?: string;
  url?: string;
  year?: number;
  rating?: number;
}

export interface SaveMessageInput {
  channel?: string;
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

  /** userId бодитоор оршиж байгаа эсэх — FK алдаанаас сэргийлнэ */
  private async safeUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const u = await this.prisma.user
      .findUnique({ where: { id: userId }, select: { id: true } })
      .catch(() => null);
    return u?.id;
  }

  async saveMessage(input: SaveMessageInput) {
    const sessionId = (input.sessionId ?? '').trim().slice(0, 64);
    const text = (input.text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    const role = ALLOWED_ROLES.has(input.role) ? input.role : 'user';
    const channel = ALLOWED_CHANNELS.has(input.channel ?? '') ? input.channel! : 'web';

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
          .findUnique({ where: { sessionId }, select: { handedOff: true } })
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
        where: { sessionId },
        create: {
          channel,
          sessionId,
          lastMessageAt: now,
          adminUnread: markAdminUnread,
          ...(input.userName ? { userName: input.userName.slice(0, 120) } : {}),
          ...(input.userImage ? { userImage: input.userImage.slice(0, 500) } : {}),
          ...(capturedEmail ? { userEmail: capturedEmail } : {}),
          ...(safeUserId ? { userId: safeUserId } : {}),
        },
        update: {
          lastMessageAt: now,
          ...(markAdminUnread ? { adminUnread: true } : {}),
          ...(input.userName ? { userName: input.userName.slice(0, 120) } : {}),
          /* ⚠️ Зураг бүрд дахин бичнэ — FB URL хугацаатай тул шинэчилж байж амьд үлдэнэ */
          ...(input.userImage ? { userImage: input.userImage.slice(0, 500) } : {}),
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
          ...(input.titles?.length ? { titles: input.titles as object } : {}),
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
        where: { sessionId: sid },
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
        where: { sessionId: sid },
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
    q?: string;
    channel?: string;
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
      ...(channel ? { channel } : {}),
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

    const [items, total, unreadTotal, byChannel] = await Promise.all([
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
       * ⚠️ Суваг тус бүрийн тоо — шүүлтийн товч дээр «FB 12» гэж
       * харуулна. Тоогүй бол админ хоосон табыг дарж шалгах хэрэгтэй
       * болно. `where`-ээс ХАМААРАХГҮЙ (бүх сувгийн бодит тоо).
       */
      this.prisma.chatConversation.groupBy({
        by: ['channel'],
        _count: { _all: true },
      }),
    ]);

    const channelCounts: Record<string, number> = {};
    for (const row of byChannel) channelCounts[row.channel] = row._count._all;

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
      channelCounts,
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
        user: { select: { id: true, name: true, email: true, avatarKey: true } },
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
      select: { id: true, userId: true, sessionId: true, channel: true },
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
      delivered = await this.sendToMessenger(conv.sessionId, t);
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
  private async sendToMessenger(psid: string, text: string): Promise<boolean> {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
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
      .findUnique({ where: { sessionId }, select: { handedOff: true } })
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
   * Олон яриаг нэг дор устгана (админ — тест яриа цэвэрлэх).
   *
   * ⚠️  нь  тул мессежүүд нь ДАГАЖ
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
