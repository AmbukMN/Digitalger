import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DiscountType, NotificationType } from '@prisma/client';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { EmailService, type EmailTemplate } from './email.service';

/** Урсгал бүрийн тохиргоо — админ панелаас дарж бичиж болно */
export interface FlowDefaults {
  campaign: EmailTemplate;
  subject: string;
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaPath: string;
  /** Хувийн купоны хямдрал (%). 0 бол купон өгөхгүй */
  couponPercent: number;
  couponDays: number;
  /**
   * Ижил хүнд дахин илгээхээс өмнө хэдэн хоног хүлээх вэ.
   * ⚠️ Хэт богино бол хэрэглэгч дарамт мэдэрч спам гэж тэмдэглэнэ →
   * бүх имэйлийн хүргэлт муудна.
   */
  cooldownDays: number;
}

/**
 * ⚠️⚠️ АНХДАГЧ ТЕКСТҮҮД — DB-д override байхгүй үед ажиллана.
 *
 * Админ панелаас засвал `EmailTemplateOverride` мөр үүсч энийг дарна.
 * Кодод байлгах шалтгаан: админ юу ч хийгээгүй байхад систем БҮРЭН
 * ажиллах ёстой (хоосон имэйл явуулахгүй).
 */
/**
 * ⚠️ EXPORT — админ панел АНХДАГЧ утгыг харуулахад ашиглана.
 * Хоосон талбар харуулбал админ юу явахыг мэдэхгүй, засах гэвэл
 * эхнээс бичих ёстой болно.
 */
export const FLOWS: Record<string, FlowDefaults> = {
  'winback-3d': {
    campaign: 'winback-3d',
    subject: 'Таны багц дууслаа — {{percent}}% хямдралтай эргэн ирээрэй',
    heading: 'Таныг санаж байна 🎬',
    bodyHtml:
      '<p>Таны багц дууссан байна. Энэ хугацаанд шинэ кино, цуврал олноор нэмэгдлээ.</p>' +
      '<p>Танд зориулж <strong>{{percent}}% хямдралтай</strong> код бэлдлээ:</p>' +
      '<p style="text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;' +
      'background:#111;color:#fff;padding:14px;border-radius:8px">{{coupon}}</p>' +
      '<p style="font-size:13px;color:#888">Код {{expires}} хүртэл хүчинтэй. ' +
      'Зөвхөн танд зориулсан.</p>',
    ctaText: 'Багцаа сунгах',
    ctaPath: '/pricing',
    couponPercent: 20,
    couponDays: 14,
    cooldownDays: 60,
  },
  'winback-14d': {
    campaign: 'winback-14d',
    subject: 'Сүүлийн санал — {{percent}}% хямдрал',
    heading: 'Хамгийн сайн саналаа өглөө',
    bodyHtml:
      '<p>Та удаагүй биднийг орхисон байна. Сүүлчийн удаа урьж байна —' +
      ' энэ бол бидний хамгийн өндөр хямдрал.</p>' +
      '<p style="text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;' +
      'background:#111;color:#fff;padding:14px;border-radius:8px">{{coupon}}</p>' +
      '<p style="font-size:13px;color:#888">{{expires}} хүртэл. Дараа нь энэ хямдрал дуусна.</p>',
    ctaText: '{{percent}}% хямдралтай авах',
    ctaPath: '/pricing',
    couponPercent: 30,
    couponDays: 7,
    cooldownDays: 120,
  },
  'no-purchase-3d': {
    campaign: 'no-purchase-3d',
    subject: 'Юу үзэхээ шийдэж чадахгүй байна уу?',
    heading: 'Тавтай морил 👋',
    bodyHtml:
      '<p>Та бүртгүүлсэн ч хараахан багц аваагүй байна. Юунаас эхлэхээ мэдэхгүй байвал' +
      ' үнэгүй үзэх боломжтой кинонуудаас эхлээрэй.</p>' +
      '<p>Шийдвэрээ гаргахад тань туслах <strong>{{percent}}% хямдрал</strong>:</p>' +
      '<p style="text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;' +
      'background:#111;color:#fff;padding:14px;border-radius:8px">{{coupon}}</p>' +
      '<p style="font-size:13px;color:#888">{{expires}} хүртэл хүчинтэй.</p>',
    ctaText: 'Багцуудыг харах',
    ctaPath: '/pricing',
    couponPercent: 15,
    couponDays: 7,
    cooldownDays: 90,
  },
  'watched-no-plan': {
    campaign: 'watched-no-plan',
    subject: 'Үлдсэн ангиудыг үзэх үү?',
    heading: 'Сайхан эхэллээ 🍿',
    bodyHtml:
      '<p>Та үнэгүй контентыг үзсэн байна. Багц авбал бүх кино, бүх ангид' +
      ' хязгааргүй нэвтэрнэ.</p>' +
      '<p>Танд зориулсан <strong>{{percent}}% хямдрал</strong>:</p>' +
      '<p style="text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;' +
      'background:#111;color:#fff;padding:14px;border-radius:8px">{{coupon}}</p>' +
      '<p style="font-size:13px;color:#888">{{expires}} хүртэл.</p>',
    ctaText: 'Бүгдийг үзэх',
    ctaPath: '/pricing',
    couponPercent: 15,
    couponDays: 7,
    cooldownDays: 60,
  },
  'inactive-30d': {
    campaign: 'inactive-30d',
    subject: 'Таны багцаар үзэх шинэ кинонууд',
    heading: 'Шинэ контент нэмэгдлээ 🎬',
    bodyHtml:
      '<p>Та удаан хугацаанд ороогүй байна. Таны багц хүчинтэй хэвээр —' +
      ' шинэ кинонууд хүлээж байна.</p>',
    ctaText: 'Шинэ кинонуудыг үзэх',
    ctaPath: '/movies',
    /* ⚠️ Купон ӨГӨХГҮЙ — энэ хүн АЛЬ ХЭДИЙН төлсөн. Хямдрал өгвөл
       «эрт авсан нь тэнэг» гэсэн мессеж болно. */
    couponPercent: 0,
    couponDays: 0,
    cooldownDays: 45,
  },
  'wallet-idle': {
    campaign: 'wallet-idle',
    subject: 'Таны хэтэвчинд {{balance}} байна',
    heading: 'Хэтэвчээ ашиглаарай 💳',
    bodyHtml:
      '<p>Таны хэтэвчинд <strong>{{balance}}</strong> үлдэгдэлтэй байна.' +
      ' Үүгээрээ багц авах эсвэл кино түрээслэх боломжтой.</p>',
    ctaText: 'Юу үзэхээ сонгох',
    ctaPath: '/pricing',
    couponPercent: 0,
    couponDays: 0,
    cooldownDays: 30,
  },
};

/** Нэг удаад хэдэн имэйл — SES-ийн хязгаар болон нэр хүндийг хамгаална */
const BATCH = 200;

/**
 * АМЬДРАЛЫН МӨЧЛӨГИЙН ИМЭЙЛ — автомат re-engagement.
 *
 * ⚠️⚠️ Багц/түрээс ДУУСАХ сануулга нь ЭНД БИШ — `ExpiryNotifyService`
 * дотор аль хэдийн байгаа. Энэ нь түүний ДАРААХ шатууд: дуусаад
 * эргэж ирээгүй, огт худалдаж аваагүй, идэвхгүй болсон хүмүүс.
 */
@Injectable()
export class LifecycleService implements OnModuleDestroy {
  private readonly logger = new Logger(LifecycleService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notify: NotificationsService,
    config: ConfigService,
  ) {
    /* ⚠️ `daily-report.service.ts`-тэй ИЖИЛ загвар (батлагдсан) */
    const url = config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => null);
  }

  /**
   * ⚠️⚠️ ӨДӨРТ НЭГ УДАА, REDIS ТҮГЖЭЭТЭЙ.
   *
   * Backend болон worker контейнер ХОЁУЛАА ижил кодыг ачаалдаг тул
   * түгжээгүй бол нэг имэйл ХОЁР УДАА явна. `ExpiryNotifyService`-д
   * түгжээ БАЙХГҮЙ (тэнд зөвхөн EmailLog шалгалт нь хамгаалдаг —
   * race-д эмзэг). Энд `daily-report.service.ts`-ийн батлагдсан
   * загварыг дагав.
   *
   * ⚠️ Цаг: 11:00 UTC = Улаанбаатарын 19:00. Оройн цагт нээх магадлал
   * өндөр (ажлын дараа кино үздэг).
   */
  @Cron('0 11 * * *')
  async runDaily() {
    const dayKey = new Date().toISOString().slice(0, 10);
    const lock = await this.redis
      .set(`cron:besttv-lifecycle:${dayKey}`, '1', 'EX', 3600, 'NX')
      .catch(() => null);
    if (!lock) {
      this.logger.log('Өөр процесс аль хэдийн ажиллуулсан — алгаслаа');
      return;
    }

    /* ⚠️ `allSettled` — нэг урсгал унавал бусад нь ҮРГЭЛЖЛЭНЭ */
    const results = await Promise.allSettled([
      this.winBack(3, 'winback-3d'),
      this.winBack(14, 'winback-14d'),
      this.noPurchase(),
      this.watchedNoPlan(),
      this.inactive30d(),
      this.walletIdle(),
    ]);

    const failed = results.filter((r) => r.status === 'rejected');
    for (const f of failed) {
      this.logger.error(`Урсгал унав: ${String((f as PromiseRejectedResult).reason)}`);
    }
  }

  // ─── Урсгалууд ────────────────────────────────────────────────────────────

  /**
   * Багц дуусаад N хоног болсон ч шинэчлээгүй хүмүүс.
   *
   * ⚠️ «Дууссан» гэдгийг зөв тодорхойлох нь ЧУХАЛ: хамгийн СҮҮЛИЙН
   * захиалга нь дууссан байх ёстой. Хуучин захиалга дууссан ч шинээр
   * авсан бол илгээх ЁСГҮЙ.
   */
  private async winBack(daysAgo: number, campaign: string) {
    const flow = await this.flow(campaign);
    if (!flow) return;

    const now = Date.now();
    /* Тухайн өдрийн цонх — өдөрт нэг ажилладаг тул 24 цагийн зурвас */
    const from = new Date(now - (daysAgo + 1) * 86_400_000);
    const to = new Date(now - daysAgo * 86_400_000);

    const expired = await this.prisma.subscription.findMany({
      where: {
        expiresAt: { gte: from, lt: to },
        user: { isActive: true, marketingOptOut: false, isGuest: false, emailVerified: true },
      },
      select: {
        userId: true,
        expiresAt: true,
        user: { select: { email: true, name: true } },
      },
      take: BATCH,
    });
    if (!expired.length) return;

    /**
     * ⚠️⚠️ ОДОО ИДЭВХТЭЙ захиалгатай хүнийг ХАСНА.
     *
     * Эс бөгөөс: хэрэглэгч 8-р сард дуусаад ШУУД шинэчилсэн байхад
     * 3 хоногийн дараа «таны багц дууслаа, эргэж ирээрэй» гэсэн имэйл
     * очно — төлсөн хүнд «чи биднийг орхисон» гэж хэлэх нь ноцтой
     * эвгүй байдал.
     */
    const userIds = expired.map((e) => e.userId);
    const stillActive = await this.prisma.subscription.findMany({
      where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
    const active = new Set(stillActive.map((s) => s.userId));

    const eligible = expired.filter((e) => !active.has(e.userId));
    await this.dispatch(flow, eligible.map((e) => ({
      userId: e.userId,
      email: e.user.email,
      name: e.user.name,
    })));
  }

  /** Бүртгүүлээд 3 хоног болсон ч ямар ч төлбөр хийгээгүй */
  private async noPurchase() {
    const flow = await this.flow('no-purchase-3d');
    if (!flow) return;

    const now = Date.now();
    const from = new Date(now - 4 * 86_400_000);
    const to = new Date(now - 3 * 86_400_000);

    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        isActive: true,
        marketingOptOut: false,
        isGuest: false,
        emailVerified: true,
        /* ⚠️ ЯМАР Ч эрх аваагүй — захиалга ч, түрээс ч байхгүй */
        subscriptions: { none: {} },
        rentals: { none: {} },
      },
      select: { id: true, email: true, name: true },
      take: BATCH,
    });

    await this.dispatch(flow, users.map((u) => ({ userId: u.id, email: u.email, name: u.name })));
  }

  /**
   * Үнэгүй контент үзсэн ч багц аваагүй.
   *
   * ⚠️ `TitleEvent`-ээс сүүлийн 7 хоногт `play` хийсэн, гэхдээ ямар ч
   * эрхгүй хүмүүс. Энэ бол хамгийн «халуун» бүлэг — сонирхлоо аль
   * хэдийн харуулсан.
   */
  private async watchedNoPlan() {
    const flow = await this.flow('watched-no-plan');
    if (!flow) return;

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const events = await this.prisma.titleEvent.findMany({
      where: { type: 'play', createdAt: { gte: weekAgo }, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
      take: 1000,
    });
    const ids = events.map((e) => e.userId).filter((v): v is string => !!v);
    if (!ids.length) return;

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        marketingOptOut: false,
        isGuest: false,
        emailVerified: true,
        subscriptions: { none: { expiresAt: { gt: new Date() } } },
      },
      select: { id: true, email: true, name: true },
      take: BATCH,
    });

    await this.dispatch(flow, users.map((u) => ({ userId: u.id, email: u.email, name: u.name })));
  }

  /**
   * Багцтай атлаа 30 хоног ороогүй.
   *
   * ⚠️ `User.lastLoginAt` талбар БАЙХГҮЙ тул `UserSession.lastUsedAt`
   * -ыг ашиглана (нэвтрэлтийн хамгийн зөв төлөөлөл).
   */
  private async inactive30d() {
    const flow = await this.flow('inactive-30d');
    if (!flow) return;

    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const subs = await this.prisma.subscription.findMany({
      where: {
        expiresAt: { gt: new Date() },
        user: { isActive: true, marketingOptOut: false, isGuest: false, emailVerified: true },
      },
      select: { userId: true, user: { select: { email: true, name: true } } },
      take: 1000,
    });
    if (!subs.length) return;

    const ids = subs.map((s) => s.userId);
    /* Сүүлийн 30 хоногт ашигласан session-тэй хүмүүс — тэднийг ХАСНА */
    const recent = await this.prisma.userSession.findMany({
      where: { userId: { in: ids }, lastUsedAt: { gte: monthAgo } },
      select: { userId: true },
    });
    const activeIds = new Set(recent.map((r) => r.userId));

    const idle = subs.filter((s) => !activeIds.has(s.userId)).slice(0, BATCH);
    await this.dispatch(flow, idle.map((s) => ({
      userId: s.userId,
      email: s.user.email,
      name: s.user.name,
    })));
  }

  /** Хэтэвчинд 1,000₮-с дээш байгаа ч 14 хоног зарцуулаагүй */
  private async walletIdle() {
    const flow = await this.flow('wallet-idle');
    if (!flow) return;

    const twoWeeks = new Date(Date.now() - 14 * 86_400_000);
    const users = await this.prisma.user.findMany({
      where: {
        walletBalance: { gte: 1000 },
        isActive: true,
        marketingOptOut: false,
        isGuest: false,
        emailVerified: true,
        /* ⚠️ Сүүлийн 14 хоногт зарцуулаагүй (сөрөг дүн = зарлага) */
        walletTxs: { none: { createdAt: { gte: twoWeeks }, amount: { lt: 0 } } },
      },
      select: { id: true, email: true, name: true, walletBalance: true },
      take: BATCH,
    });

    await this.dispatch(
      flow,
      users.map((u) => ({
        userId: u.id,
        email: u.email,
        name: u.name,
        vars: { balance: this.email.fmtMoney(u.walletBalance) },
      })),
    );
  }

  // ─── Дундын логик ─────────────────────────────────────────────────────────

  /**
   * Урсгалын тохиргоог DB-ийн override-тай нийлүүлнэ.
   * @returns `null` бол урсгал УНТРААЛТТАЙ
   */
  private async flow(campaign: string): Promise<FlowDefaults | null> {
    const base = FLOWS[campaign];
    if (!base) return null;

    const row = await this.prisma.emailTemplateOverride
      .findUnique({ where: { campaign } })
      .catch(() => null);

    if (row && !row.isEnabled) return null;
    if (!row) return base;

    /* ⚠️ Хоосон талбарыг анхдагчаар нөхнө — админ зөвхөн гарчгийг
       засаад биеийг хоосон үлдээвэл имэйл ХООСОН явах ёсгүй */
    return {
      ...base,
      subject: row.subject.trim() || base.subject,
      heading: row.heading.trim() || base.heading,
      bodyHtml: row.bodyHtml.trim() || base.bodyHtml,
      ctaText: row.ctaText.trim() || base.ctaText,
      couponPercent: row.couponPercent > 0 ? row.couponPercent : base.couponPercent,
      couponDays: row.couponDays > 0 ? row.couponDays : base.couponDays,
    };
  }

  /**
   * Хүлээн авагчдад илгээнэ — давхардлыг шалгаж, купон үүсгэнэ.
   */
  private async dispatch(
    flow: FlowDefaults,
    targets: { userId: string; email: string; name?: string | null; vars?: Record<string, string> }[],
  ) {
    if (!targets.length) return;

    /**
     * ⚠️⚠️ ДАВХАР ИЛГЭЭХЭЭС СЭРГИЙЛНЭ — `EmailLog`-оор.
     *
     * Тусдаа `sentAt` багана нэмэхийн оронд EmailLog ашиглах нь
     * `ExpiryNotifyService`-ийн батлагдсан загвар. `@@index([template,
     * createdAt])` байгаа тул хурдан.
     */
    const since = new Date(Date.now() - flow.cooldownDays * 86_400_000);
    const sent = await this.prisma.emailLog.findMany({
      where: {
        template: flow.campaign,
        createdAt: { gte: since },
        userId: { in: targets.map((t) => t.userId) },
      },
      select: { userId: true },
    });
    const already = new Set(sent.map((s) => s.userId));

    let count = 0;
    for (const t of targets) {
      if (already.has(t.userId) || !t.email) continue;

      const vars: Record<string, string> = { ...(t.vars ?? {}) };

      /* Хувийн купон — шаардлагатай урсгалд */
      if (flow.couponPercent > 0) {
        const coupon = await this.issueCoupon(t.userId, flow);
        if (!coupon) continue; // купон үүсгэж чадсангүй — имэйл явуулахгүй
        vars.coupon = coupon.code;
        vars.percent = String(flow.couponPercent);
        vars.expires = this.email.fmtDate(coupon.expiresAt);
      }

      const subject = this.render(flow.subject, vars);
      this.email.sendMarketing({
        to: t.email,
        subject,
        heading: this.render(flow.heading, vars),
        bodyHtml: this.render(flow.bodyHtml, vars),
        ctaText: this.render(flow.ctaText, vars),
        ctaUrl: `${process.env.FRONTEND_URL ?? 'https://besttv.us'}${flow.ctaPath}`,
        userId: t.userId,
        template: flow.campaign,
      });

      /* ⚠️ Хонхны мэдэгдэл ч хамт — имэйл спамд орсон ч хэрэглэгч
         сайт дээрээ саналыг харна */
      this.notify.create(
        t.userId,
        NotificationType.INFO,
        this.render(flow.heading, vars),
        vars.coupon ? `Купон: ${vars.coupon}` : subject,
        flow.ctaPath,
      );

      count++;
    }

    if (count) this.logger.log(`${flow.campaign}: ${count} хэрэглэгчид илгээв`);
  }

  /**
   * ХУВИЙН купон үүсгэнэ — зөвхөн тэр хэрэглэгч ашиглана.
   *
   * ⚠️⚠️ Нийтлэг код (ж «BUCAJIREE20») хэрэглэвэл нэг хүн олон нийтэд
   * тарааж, бүгд ашиглана. Захиалгын бизнест энэ нь шууд алдагдал.
   *
   * ⚠️ Кодыг ТААМАГЛАХ БОЛОМЖГҮЙ байлгана — дараалсан тоо биш,
   * санамсаргүй тэмдэгт. Эс бөгөөс хэн нэгэн бусдын кодыг таамаглана.
   */
  private async issueCoupon(
    userId: string,
    flow: FlowDefaults,
  ): Promise<{ code: string; expiresAt: Date } | null> {
    const expiresAt = new Date(Date.now() + flow.couponDays * 86_400_000);

    /* ⚠️ Аль хэдийн олгосон, ХҮЧИНТЭЙ код байвал ДАХИН ашиглана —
       нэг хүнд хоёр код өгвөл эргэлзээ төрүүлнэ */
    const existing = await this.prisma.coupon.findFirst({
      where: {
        userId,
        campaign: flow.campaign,
        isActive: true,
        usedCount: 0,
        expiresAt: { gt: new Date() },
      },
      select: { code: true, expiresAt: true },
    });
    if (existing?.expiresAt) return { code: existing.code, expiresAt: existing.expiresAt };

    /* Давхардлаас сэргийлж 3 удаа оролдоно */
    for (let i = 0; i < 3; i++) {
      const code = `BTV${randomBytes(3).toString('hex').toUpperCase()}`;
      try {
        const row = await this.prisma.coupon.create({
          data: {
            code,
            discountType: DiscountType.PERCENT,
            amount: flow.couponPercent,
            /* ⚠️ `maxUses: 1` — хувийн код нэг л удаа */
            maxUses: 1,
            expiresAt,
            isActive: true,
            userId,
            campaign: flow.campaign,
          },
          select: { code: true, expiresAt: true },
        });
        return row.expiresAt ? { code: row.code, expiresAt: row.expiresAt } : null;
      } catch {
        /* code давхардсан — дахин оролдоно */
      }
    }
    this.logger.error(`Купон үүсгэж чадсангүй (user=${userId}, ${flow.campaign})`);
    return null;
  }

  /** `{{key}}` орлуулга */
  private render(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
  }
}
