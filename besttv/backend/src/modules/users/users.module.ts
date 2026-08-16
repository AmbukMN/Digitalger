import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import { Role, Prisma, AuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  /**
   * ⚠️⚠️ `@IsEnum` — `@IsString()` байсан нь эрх нэмэгдүүлэх талбарт
   * ХАНГАЛТГҮЙ: TypeScript-ийн `Role` төрөл нь зөвхөн compile-time.
   * "SUPERADMIN", "admin" (жижиг үсгээр) гэх мэт дурын мөр Prisma руу
   * шууд дамжина. Жижиг үсгээр DB-д орвол `RolesGuard`-ийн
   * `user.role === role` харьцуулалт таарахаа болино.
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

class SetPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}

class GrantSubscriptionDto {
  @IsString()
  planId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
}

class BulkDeleteDto {
  /** Устгах хэрэглэгчийн ID-ууд (нэг удаад дээд тал нь 200) */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids: string[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    /**
     * ⚠️ Аватар — `avatarKey` нь R2-ийн KEY, browser шууд ачаалж
     * ЧАДАХГҮЙ. Хариунд presigned URL болгож өгнө.
     */
    private readonly storage: StorageService,
  ) {}

  /**
   * Аватарын key → үзэгдэх URL.
   *
   * ⚠️ Алдаа шидэхгүй — аватар нь ЧИМЭЭГҮЙ доройтох ёстой. R2 унавал
   * хэрэглэгчийн жагсаалт БҮХЭЛДЭЭ унах ёсгүй (нэрийн эхний үсэг рүү
   * буулгана).
   */
  private async avatarUrl(key?: string | null): Promise<string | null> {
    if (!key) return null;
    return this.storage.publicAssetUrl(key, 7200).catch(() => null);
  }

  /**
   * Хэрэглэгчийн шүүлт — НЭГ цэгээс (жагсаалт, тоолол, export ижил).
   *
   * ⚠️ `sub` шүүлт: 'active' = идэвхтэй багцтай, 'none' = багцгүй.
   * Prisma-д `some`/`none` нь relation дээр ажиллана.
   */
  private buildWhere(params: {
    q?: string;
    role?: string;
    status?: string;
    sub?: string;
    provider?: string;
    from?: string;
    to?: string;
  }): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    const term = params.q?.trim();
    if (term) {
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { id: term },
      ];
    }

    if (params.role && params.role !== 'ALL') where.role = params.role as Role;
    if (params.status === 'active') where.isActive = true;
    else if (params.status === 'blocked') where.isActive = false;
    if (params.provider && params.provider !== 'ALL') {
      where.provider = params.provider as AuthProvider;
    }

    const now = new Date();
    if (params.sub === 'active') {
      where.subscriptions = { some: { expiresAt: { gt: now } } };
    } else if (params.sub === 'none') {
      where.subscriptions = { none: { expiresAt: { gt: now } } };
    }

    // ⚠️ `to` нь тухайн ӨДРИЙГ бүтнээр хамруулна
    if (params.from || params.to) {
      const range: Prisma.DateTimeFilter = {};
      if (params.from) range.gte = new Date(params.from);
      if (params.to) {
        const end = new Date(params.to);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.createdAt = range;
    }

    return where;
  }

  /**
   * Табын badge-д зориулсан тоолол.
   * ⚠️ Хайлт/огнооны шүүлтийг ХҮНДЭТГЭНЭ — эс бөгөөс "хайлт хийсэн ч
   * тоо өөрчлөгдөхгүй" гэсэн эвгүй байдал үүснэ.
   */
  async counts(params: { q?: string; from?: string; to?: string }) {
    const base = this.buildWhere(params);
    const now = new Date();
    const [all, active, blocked, withSub, admins] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, isActive: true } }),
      this.prisma.user.count({ where: { ...base, isActive: false } }),
      this.prisma.user.count({
        where: { ...base, subscriptions: { some: { expiresAt: { gt: now } } } },
      }),
      this.prisma.user.count({ where: { ...base, role: Role.ADMIN } }),
    ]);
    return { ALL: all, active, blocked, withSub, admins };
  }

  async list(params: {
    q?: string;
    role?: string;
    status?: string;
    sub?: string;
    provider?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Number(params.limit) || 20);
    const where = this.buildWhere(params);
    const orderBy = {
      [params.sort ?? 'createdAt']: params.dir ?? 'desc',
    } as Prisma.UserOrderByWithRelationInput;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          provider: true,
          emailVerified: true,
          walletBalance: true,
          createdAt: true,
          /* ⚠️ Аватар — жагсаалтад нүүрээр таних (админы хүсэлт) */
          avatarKey: true,
          subscriptions: {
            where: { expiresAt: { gt: new Date() } },
            orderBy: { expiresAt: 'desc' },
            take: 1,
            select: { expiresAt: true, plan: { select: { name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    /**
     * ⚠️ Аватарын URL-ийг БАГЦААР presign — мөр бүрд await хийвэл
     * 20 хэрэглэгчид 20 дараалсан дуудалт болж жагсаалт удаашрана.
     */
    const avatarUrls = await Promise.all(items.map((u) => this.avatarUrl(u.avatarKey)));

    return {
      items: items.map((u, i) => ({
        ...u,
        avatarUrl: avatarUrls[i],
        /* ⚠️ Түлхүүрийг клиент рүү явуулахгүй — зөвхөн URL */
        avatarKey: undefined,
        activeSubscription: u.subscriptions[0]
          ? { planName: u.subscriptions[0].plan.name, expiresAt: u.subscriptions[0].expiresAt }
          : null,
        subscriptions: undefined,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        provider: true,
        emailVerified: true,
        /* ⚠️ Утас — гомдол шийдэхэд чухал (хэн ямар дугаартай, эзэн нь
           үнэхээр баталгаажуулсан эсэх) */
        phone: true,
        phoneVerified: true,
        pendingPhone: true,
        isGuest: true,
        walletBalance: true,
        createdAt: true,
        /* ⚠️ Аватар — админ хэнтэй харьцаж буйгаа нүүрээр таана */
        avatarKey: true,
        /**
         * ⚠️⚠️ ТӨЛБӨРИЙН 3 ТӨРӨЛ — ЯЛГАХ ТАЛБАР ЗААВАЛ.
         *
         * БОДИТ АЛДАА: өмнө нь зөвхөн `plan.name` сонгодог байсан тул
         * plan-гүй БҮХ төлбөр (түрээс, банкны шилжүүлэг) админд
         * «Хэтэвч цэнэглэлт» гэж ХУДАЛ харагддаг байв. Хэрэглэгч
         * 4,900₮-өөр кино түрээсэлсэн атал «цэнэглэлт» гэж бичигдсэн
         * (production дээр батлагдсан).
         *
         * Ялгах гурван талбар:
         *   planId        → багц худалдан авалт
         *   isWalletTopup → хэтэвч цэнэглэлт
         *   rentalTitleId → ширхэгээр түрээс
         *
         * ⚠️ take нэмэгдсэн: 10 → 50. Идэвхтэй хэрэглэгчийн эхний 10
         *    захиалгын дараах нь ОГТ харагддаггүй байв.
         */
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            amount: true,
            originalAmount: true,
            status: true,
            createdAt: true,
            paidAt: true,
            isWalletTopup: true,
            couponCode: true,
            bankReference: true,
            plan: { select: { id: true, name: true } },
            rentalTitle: { select: { id: true, title: true, slug: true } },
          },
        },
        subscriptions: {
          orderBy: { expiresAt: 'desc' },
          take: 10,
          select: {
            id: true,
            startsAt: true,
            expiresAt: true,
            /** null = админ гараар олгосон (төлбөргүй) */
            paymentId: true,
            plan: {
              select: {
                id: true,
                name: true,
                isVip: true,
                genres: { select: { genre: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        myList: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { createdAt: true, title: { select: { id: true, title: true, slug: true, posterKey: true } } },
        },
        /**
         * ⚠️ АНГИ ЗААВАЛ — цуврал үзэж буй хэрэглэгч АЛЬ ангид явааг
         * админ мэдэх ёстой. Өмнө нь зөвхөн киноны нэр харагддаг тул
         * «6-р анги дээр гацсан» гэх гомдол шалгах боломжгүй байв.
         */
        watchProgress: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            positionSec: true,
            durationSec: true,
            updatedAt: true,
            title: { select: { id: true, title: true, slug: true, type: true } },
            episode: {
              select: {
                id: true,
                number: true,
                name: true,
                season: { select: { number: true } },
              },
            },
          },
        },
        /**
         * ⚠️ ТҮРЭЭС — багцаас ТУСДАА эрх. Өмнө нь админд ОГТ харагддаггүй
         * байсан тул "төлбөр төлсөн атлаа юу авсан нь мэдэгдэхгүй" гэсэн
         * гомдол шийдэхэд хэцүү байв.
         */
        rentals: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            amount: true,
            /**
             * ⚠️ null = ХЭТЭВЧНЭЭС төлсөн — Payment мөр ОГТ үүсдэггүй.
             * Админ «Захиалга» табд харахгүй тул тэнд тусад нь нэмнэ.
             */
            paymentId: true,
            title: { select: { id: true, title: true, slug: true } },
          },
        },
        /** Сэтгэгдэл — зохисгүй агуулга шалгах, хэрэглэгчийн идэвх харах */
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            title: { select: { title: true, slug: true } },
          },
        },
        /** Хэтэвчний гүйлгээ — мөнгө хаашаа явсныг мөрдөнө */
        walletTxs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, amount: true, type: true, description: true, createdAt: true },
        },
        /**
         * ⚠️ МЭДЭГДЭЛ — хэрэглэгчид ЮУ ХАРАГДСАНЫГ админ мэдэх ёстой.
         * «Би мэдэгдэл аваагүй» гэсэн гомдлыг шууд шалгана.
         */
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            readAt: true,
            createdAt: true,
          },
        },
        /**
         * ⚠️ НЭВТЭРСЭН ТӨХӨӨРӨМЖ — «яагаад гарчихав» гэсэн гомдолд
         * хариулна (2 төхөөрөмжийн хязгаар).
         */
        sessions: {
          orderBy: { lastUsedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            deviceName: true,
            ip: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
        /** ⚠️ Ашигласан урамшуулал — «яагаад хямд авав» гэдгийг тайлбарлана */
        promotionRedemptions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            valueGiven: true,
            daysGiven: true,
            createdAt: true,
            promotion: { select: { name: true, type: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    /**
     * ⚠️ ИДЭВХИЙН ХУРААНГУЙ — тусад нь тоолно (relation-д `take` тавьсан
     * тул `_count` нь буруу гарна). Хэрэглэгч хэр идэвхтэйг нэг харцаар.
     */
    const [
      viewCount,
      searchCount,
      lastSeen,
      auditLog,
      bankPayments,
      playCount,
      totalSpent,
      recentSearches,
      chats,
      titleEvents,
      watchAgg,
    ] = await Promise.all([
      this.prisma.pageView.count({ where: { userId: id } }),
      this.prisma.searchEvent.count({ where: { userId: id } }),
      this.prisma.pageView.findFirst({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, path: true, device: true },
      }),
      /**
       * ⚠️⚠️ АУДИТ ЛОГ — хамгийн чухал tracking. Нэвтрэлт, нууц үг
       * солих, эрх өөрчлөх, админы гар үйлдэл БҮГД энд бүртгэгддэг
       * атлаа админ панелд ОГТ харагддаггүй байв.
       */
      this.prisma.userAuditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          field: true,
          oldValue: true,
          newValue: true,
          actor: true,
          ip: true,
          createdAt: true,
        },
      }),
      /** ⚠️ Дансны төлбөр — гараар баталгаажуулсан түүх */
      this.prisma.payment.findMany({
        where: { userId: id, bankReference: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          status: true,
          bankReference: true,
          bankClaimedAt: true,
          bankReviewedAt: true,
          bankRejectReason: true,
          createdAt: true,
        },
      }),
      this.prisma.titleEvent.count({ where: { userId: id, type: 'play' } }),
      /* ⚠️ НИЙТ ЗАРЦУУЛСАН — хэрэглэгчийн үнэ цэнийг харуулна
         (хэн VIP хэрэглэгч болохыг мэдэх) */
      this.prisma.payment.aggregate({
        where: { userId: id, status: 'PAID', isWalletTopup: false },
        _sum: { amount: true },
      }),
      /* ⚠️ Хайсан үгс — юуг хайсан ч олоогүйг мэдвэл контент нэмнэ */
      this.prisma.searchEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { query: true, results: true, createdAt: true },
      }),
      /**
       * ⚠️⚠️ ЧАТ ЯРИА — админд ОГТ харагддаггүй байв.
       *
       * Хэрэглэгч чатаар гомдол/асуулт бичсэн ч админ хэрэглэгчийн
       * хуудсан дээрээс харах боломжгүй, тусдаа Чат хуудас руу орж
       * хайх шаардлагатай байсан. Гомдол шийдэхэд шууд хэрэгтэй.
       */
      this.prisma.chatConversation.findMany({
        where: { userId: id },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        select: {
          id: true,
          channel: true,
          lastMessageAt: true,
          handedOff: true,
          createdAt: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: {
              id: true,
              role: true,
              text: true,
              attachmentKey: true,
              attachmentType: true,
              createdAt: true,
            },
          },
        },
      }),
      /**
       * ⚠️⚠️ АНГИ БҮРИЙН ҮЗСЭН ТҮҮХ — WatchProgress нь нэг Title-д НЭГ
       * мөр (@@unique) тул өмнөх ангиуд ДАРАГДАЖ АЛГА БОЛДОГ.
       *
       * Бүтэн түүх нь `TitleEvent`-д (append-only, episodeId-тэй).
       * Админ «аль ангийг хэзээ үзсэн» гэдгийг эндээс л мэднэ.
       *
       * ⚠️ `progress` төрөл нь 60 секунд тутам бичигддэг тул МАШ ОЛОН —
       *    зөвхөн `play`/`complete` (эхлүүлсэн/дуусгасан) авна.
       */
      this.prisma.titleEvent.findMany({
        where: { userId: id, type: { in: ['play', 'complete'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          type: true,
          titleId: true,
          titleName: true,
          titleSlug: true,
          episodeId: true,
          positionSec: true,
          durationSec: true,
          device: true,
          createdAt: true,
        },
      }),
      /**
       * ⚠️ НИЙТ ҮЗСЭН ХУГАЦАА — БҮХ киноны нийлбэр.
       *
       * `/admin/tracking` нь сүүлийн 20 мөрөөр л бодож байсан тул
       * бодит нийлбэрээс БАГА гардаг байв.
       */
      this.prisma.watchProgress.aggregate({
        where: { userId: id },
        _sum: { positionSec: true },
        _count: true,
      }),
    ]);

    /**
     * ⚠️ Ангийн ID → дугаар/нэр хөрвүүлэлт.
     *
     * `TitleEvent.episodeId` нь FK БИШ (зориуд fail-open) тул Prisma
     * join хийж чадахгүй. Тиймээс гарсан ID-уудыг цуглуулж НЭГ
     * query-ээр татна (N+1 биш).
     */
    const epIds = [...new Set(titleEvents.map((e) => e.episodeId).filter(Boolean))] as string[];
    const eps = epIds.length
      ? await this.prisma.episode.findMany({
          where: { id: { in: epIds } },
          select: {
            id: true,
            number: true,
            name: true,
            season: { select: { number: true } },
          },
        })
      : [];
    const epMap = new Map(eps.map((e) => [e.id, e]));

    return {
      ...user,
      /* ⚠️ Key биш URL — browser нь R2 key-г ачаалж чадахгүй */
      avatarUrl: await this.avatarUrl(user.avatarKey),
      avatarKey: undefined,
      auditLog,
      bankPayments,
      recentSearches,
      chats,
      /** Анги бүрийн үзсэн түүх — ангийн дугаар нөхөж өгнө */
      episodeHistory: titleEvents.map((e) => ({
        ...e,
        episode: e.episodeId ? (epMap.get(e.episodeId) ?? null) : null,
      })),
      activity: {
        viewCount,
        searchCount,
        playCount,
        totalSpent: totalSpent._sum.amount ?? 0,
        lastSeen,
        /** Нийт үзсэн хугацаа (секунд) — БҮХ киноны нийлбэр */
        totalWatchSec: watchAgg._sum.positionSec ?? 0,
        /** Хэдэн өөр кино үзсэн */
        watchedTitles: watchAgg._count,
      },
    };
  }

  /**
   * @param actorId — үйлдэл хийж буй АДМИНЫ id (өөрийгөө хамгаалахад)
   */
  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    /**
     * ⚠️ Админ ӨӨРИЙНХӨӨ эрхийг бууруулахыг хориглоно — эс бөгөөс
     * санамсаргүй USER болж, админ панелиас БҮРМӨСӨН гарна (сэргээх
     * цорын ганц зам нь DB-д гараар засах). `bulkDelete` нь өөрийгөө
     * устгахаас 3 хамгаалалттай атлаа энд ижил бодол байгаагүй.
     */
    if (dto.role && dto.role !== user.role && id === actorId) {
      throw new BadRequestException('Өөрийн эрхийг өөрчлөх боломжгүй');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      /**
       * ⚠️⚠️ `select` ЗААВАЛ — эс бөгөөс Prisma БҮХ баганыг буцаана:
       * `passwordHash` (bcrypt), `googleId`, `facebookId`. Тэр нь HTTP
       * хариунд орж админы browser/proxy/лог/Sentry-д хадгалагдана.
       * Ижил файлын `list()`/`get()` нь `select`-ээ зөв бичсэн байсан
       * атлаа энд орхигдсон.
       */
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        provider: true, emailVerified: true, walletBalance: true,
        avatarKey: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async setPassword(id: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  /**
   * Админаас багц олгох.
   *
   * ⚠️ VIP-ийн ОНЦГОЙ ДҮРЭМ:
   *   - VIP олгоход → бусад БҮХ идэвхтэй багц ХҮЧИНГҮЙ болно (VIP нь бүх
   *     контентыг нээдэг тул тэдгээр илүүдэл)
   *   - VIP байхад ӨӨР багц олгоход → VIP ХҮЧИНГҮЙ болно (админ зориуд
   *     "зөвхөн энэ жанр" болгож бууруулж байна гэсэн үг)
   *
   * Өмнө нь хоёулаа зэрэг идэвхтэй үлдэж, VIP дарж бүх кино үнэгүй болдог
   * АЛДААТАЙ байсан.
   *
   * ⚠️ Мөн хугацаа: ЗӨВХӨН ижил багцын үлдэгдэл дээр залгана (өмнө нь өөр
   * багцын дуусах огнооноос эхлүүлж, хугацаа буруу уртасдаг байсан).
   */
  async grantSubscription(id: string, dto: GrantSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('Багц олдсонгүй');

    const now = new Date();
    const days = dto.days ?? plan.durationDays;

    // Ижил багцын идэвхтэй эрх байвал ТҮҮН дээр залгаж сунгана
    const sameActive = await this.prisma.subscription.findFirst({
      where: { userId: id, planId: dto.planId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    });
    const startsAt = sameActive ? sameActive.expiresAt : now;
    const expiresAt = new Date(startsAt.getTime() + days * 86400_000);

    return this.prisma.$transaction(async (tx) => {
      // ── VIP ↔ энгийн багцыг харилцан ХҮЧИНГҮЙ болгоно ──
      if (plan.isVip) {
        // VIP олгож байна → бусад бүх багц илүүдэл
        await tx.subscription.updateMany({
          where: { userId: id, expiresAt: { gt: now }, plan: { isVip: false } },
          data: { expiresAt: now },
        });
      } else {
        // Энгийн багц олгож байна → VIP хүчингүй (админ зориуд бууруулж байна)
        await tx.subscription.updateMany({
          where: { userId: id, expiresAt: { gt: now }, plan: { isVip: true } },
          data: { expiresAt: now },
        });
      }

      return tx.subscription.create({
        data: { userId: id, planId: dto.planId, startsAt, expiresAt },
      });
    });
  }

  /**
   * ⚠️⚠️ БӨӨНӨӨР УСТГАХ — тест хэрэглэгч цэвэрлэхэд.
   *
   * УСТГАЛТ БУЦААГДАХГҮЙ тул 3 ХАМГААЛАЛТ:
   *   1. ӨӨРИЙГӨӨ устгахгүй (админ өөрийгөө хаачихвал системд орох аргагүй)
   *   2. ADMIN эрхтэйг устгахгүй (санамсаргүй бусад админыг арилгахаас)
   *   3. ТӨЛБӨР ТӨЛСӨН хэрэглэгчийг устгахгүй — санхүүгийн бүртгэл
   *      (Payment/WalletTransaction) алдагдвал тайлан эвдэрнэ. Тэднийг
   *      устгахын оронд `isActive: false` болгож хаах ёстой.
   *
   * Устгагдсанаар Prisma `onDelete: Cascade`-аар холбоотой мөрүүд
   * (subscription, myList, watchProgress, review...) автоматаар цэвэрлэгдэнэ.
   */
  async bulkDelete(ids: string[], actorId: string) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) throw new BadRequestException('ID сонгоогүй байна');

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        email: true,
        role: true,
        _count: { select: { payments: true, walletTxs: true } },
      },
    });

    const skipped: { email: string; reason: string }[] = [];
    const deletable: string[] = [];

    for (const u of users) {
      if (u.id === actorId) {
        skipped.push({ email: u.email, reason: 'Өөрийгөө устгах боломжгүй' });
      } else if (u.role === Role.ADMIN) {
        skipped.push({ email: u.email, reason: 'Админ эрхтэй' });
      } else if (u._count.payments > 0 || u._count.walletTxs > 0) {
        skipped.push({ email: u.email, reason: 'Төлбөрийн бүртгэлтэй — хаах хэрэгтэй' });
      } else {
        deletable.push(u.id);
      }
    }

    const { count } = deletable.length
      ? await this.prisma.user.deleteMany({ where: { id: { in: deletable } } })
      : { count: 0 };

    return { deleted: count, skipped };
  }
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('sub') sub?: string,
    @Query('provider') provider?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.list({ q, role, status, sub, provider, from, to, sort, dir, page, limit });
  }

  /** Шүүлтэд тохирсон тоолол — табын badge */
  @Get('counts')
  counts(
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.counts({ q, from, to });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    /* ⚠️ Админ ӨӨРИЙНХӨӨ эрхийг бууруулахаас сэргийлнэ */
    @CurrentUser() me: JwtPayload,
  ) {
    return this.svc.update(id, dto, me.sub);
  }

  @Post(':id/password')
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.svc.setPassword(id, dto.password);
  }

  @Post(':id/grant-subscription')
  grantSubscription(@Param('id') id: string, @Body() dto: GrantSubscriptionDto) {
    return this.svc.grantSubscription(id, dto);
  }

  /**
   * ⚠️⚠️ БӨӨНӨӨР УСТГАХ — тест хэрэглэгч цэвэрлэхэд.
   *
   * `@Post` ашигласан шалтгаан: `@Delete` нь body-г найдвартай дэмждэггүй
   * (зарим proxy/browser хаядаг). ID жагсаалт body-гоор явна.
   */
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() actor: JwtPayload) {
    return this.svc.bulkDelete(dto.ids, actor.sub);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
