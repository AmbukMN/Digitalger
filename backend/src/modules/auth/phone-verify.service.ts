import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { VerifyMnService } from './verify-mn.service';

// SMS cost хамгаалах: нэг хэрэглэгчийн сүүлийн pending session 60с дотор бол
// шинэ SMS session үүсгэхгүй (verify.mn бүр session SMS зардалтай).
const PHONE_VERIFY_COOLDOWN_SECONDS = 60;

export type PhoneVerifyStatus = 'pending' | 'verified' | 'expired';

@Injectable()
export class PhoneVerifyService {
  private readonly logger = new Logger(PhoneVerifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly verifyMn: VerifyMnService,
    private readonly email: EmailService,
    private readonly notifications: NotificationCenterService,
  ) {}

  /**
   * Утас баталгаажуулах хүсэлт — verify.mn session үүсгэж, хэрэглэгчид 144773 руу
   * илгээх код/зааврыг буцаана.
   */
  async requestPhoneVerify(userId: string, phone: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // ── Uniqueness: өөр хэрэглэгчийн БАТАЛГААЖСАН утас бол зөвшөөрөхгүй ──
    // (verify-гүй давхцлыг зөвшөөрнө — нэг хэрэглэгч л баталгаажуулж чадна).
    const owner = await this.prisma.user.findFirst({
      where: { phone, phoneVerified: { not: null }, id: { not: userId } },
      select: { id: true },
    });
    if (owner) {
      throw new ConflictException('Энэ утасны дугаар өөр хэрэглэгчид бүртгэлтэй байна');
    }

    // ── Хуучин pending session байвал ДАХИН АШИГЛАХ (cooldown алдаа шидэхгүй) ──
    // Хэрэглэгч буруу даргаад Dialog хаагаад дахин дарвал — ижил утас + хугацаа
    // дуусаагүй pending session байвал тэр кодыг буцаана (шинэ SMS зардал гарахгүй,
    // 'X секунд хүлээ' алдаа гарахгүй). UX шуурхай.
    const reusable = await this.prisma.phoneVerifySession.findFirst({
      where: {
        userId,
        phone,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (reusable) {
      // verify.mn-ийн одоо байгаа session-ий мэдээллийг дахин угсарч буцаана.
      const smsBody = `${reusable.code}`;
      const sc = this.config.get<string>('verifyMn.shortcode') ?? '144773';
      return {
        sessionId: reusable.verifyMnSessionId,
        code: reusable.code,
        shortcode: sc,
        smsUri: `sms:${sc}?body=${encodeURIComponent(smsBody)}`,
        displayInstruction: `${sc} дугаарт "${reusable.code}" гэж SMS илгээнэ үү`,
        expiresAt: reusable.expiresAt.toISOString(),
      };
    }

    // Хуучин pending session-уудыг expired болгоно (нэг идэвхтэй session л байна).
    // (ӨӨР утас руу солих эсвэл хугацаа дууссан тохиолдол.)
    await this.prisma.phoneVerifySession.updateMany({
      where: { userId, status: 'pending' },
      data: { status: 'expired' },
    });

    // 6 оронтой код — хэрэглэгч үүнийг 144773 руу SMS-ээр илгээнэ.
    const code = String(crypto.randomInt(100000, 999999));

    // ⚠️ callbackUrl-д sid суулгана — verify.mn callback нь body-гүй ирдэг тул
    // аль session дуудагдсаныг зөвхөн URL-ийн sid query-ээр л ялгаж чадна.
    const callbackBase = this.config.get<string>('verifyMn.callbackUrl') ?? null;

    // ⚠️ verify.mn-ийн sessionId-г эхний хариунаас л мэдэх тул callbackUrl-д
    // түүнийг урьдчилан суулгаж чадахгүй. Иймд callback дотор session-аа найдвартай
    // олохын тулд бид өөрсдийн үүсгэх PhoneVerifySession.id (localSessionId)-г
    // callbackUrl-ийн sid query-д суулгана (callback ирэхэд sid-ээр олно).
    const localSessionId = crypto.randomUUID();
    const callbackUrl = callbackBase
      ? `${callbackBase}${callbackBase.includes('?') ? '&' : '?'}sid=${encodeURIComponent(localSessionId)}`
      : null;

    const session = await this.verifyMn.createSession(phone, code, callbackUrl);

    // PhoneVerifySession үүсгэнэ. id = localSessionId (callback-д sid-ээр ирнэ),
    // verifyMnSessionId = verify.mn-ийн sessionId (polling/status-д ашиглана).
    await this.prisma.phoneVerifySession.create({
      data: {
        id: localSessionId,
        userId,
        phone,
        code,
        verifyMnSessionId: session.sessionId,
        status: 'pending',
        expiresAt: new Date(session.expiresAt),
      },
    });

    // pendingPhone-д хадгална (баталгаажтал User.phone солихгүй).
    await this.prisma.user
      .update({ where: { id: userId }, data: { pendingPhone: phone } })
      .catch(() => {});

    return {
      sessionId: session.sessionId, // polling-д (b endpoint) ашиглана
      code, // ⚠️ Хэрэглэгч 144773 руу илгээх КОД (frontend regex биш, шууд буцаана).
      shortcode: this.config.get<string>('verifyMn.shortcode') ?? '144773',
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Polling — session-ий төлвийг шалгана (verify.mn GET /sessions/{id}).
   * VERIFIED бол User.phone/phoneVerified тавьж, имэйл мэдэгдэл явуулна.
   * @param verifyMnSessionId verify.mn-ийн sessionId (frontend-аас ирнэ).
   */
  async getStatus(
    userId: string,
    verifyMnSessionId: string,
  ): Promise<{ status: PhoneVerifyStatus }> {
    const local = await this.prisma.phoneVerifySession.findFirst({
      where: { verifyMnSessionId, userId },
    });
    if (!local) throw new NotFoundException('Session олдсонгүй');

    return this.resolveSession(local);
  }

  /**
   * verify.mn callback (wake-up signal) — sid-ээр session олж, төлвийг
   * шалгана/шинэчилнэ. ⚠️ Зөвхөн дохио тул заавал getSessionStatus-аар
   * баталгаажуулна (resolveSession дотор). userId шаардахгүй (callback нь
   * verify.mn-ээс ирдэг тул JWT байхгүй) — sid (PhoneVerifySession.id) хангалттай.
   */
  async handleCallback(localSessionId: string): Promise<void> {
    if (!localSessionId) return;
    const local = await this.prisma.phoneVerifySession.findUnique({
      where: { id: localSessionId },
    });
    if (!local) {
      this.logger.warn(`Phone verify callback — session олдсонгүй (sid=${localSessionId})`);
      return;
    }
    await this.resolveSession(local).catch((err) =>
      this.logger.error(`Phone verify callback resolve алдаа: ${err}`),
    );
  }

  // ─── internal ───────────────────────────────────────────────────────────────

  /**
   * PhoneVerifySession-ий төлвийг verify.mn-ээс шалгаж шинэчилнэ.
   * Аль хэдийн verified бол verify.mn дахин дуудахгүй (cost/429 хамгаалал).
   */
  private async resolveSession(local: {
    id: string;
    userId: string;
    phone: string;
    verifyMnSessionId: string;
    status: string;
  }): Promise<{ status: PhoneVerifyStatus }> {
    if (local.status === 'verified') return { status: 'verified' };
    if (local.status === 'expired') return { status: 'expired' };

    const remote = await this.verifyMn.getSessionStatus(local.verifyMnSessionId);

    if (remote.sessionStatus === 'VERIFIED') {
      await this.markVerified(local);
      return { status: 'verified' };
    }

    if (remote.sessionStatus === 'EXPIRED') {
      await this.prisma.phoneVerifySession
        .update({ where: { id: local.id }, data: { status: 'expired' } })
        .catch(() => {});
      return { status: 'expired' };
    }

    return { status: 'pending' };
  }

  /** VERIFIED болсон session-ийг батална: User шинэчилж, имэйл/audit бичнэ. */
  private async markVerified(local: {
    id: string;
    userId: string;
    phone: string;
  }): Promise<void> {
    const now = new Date();

    // ⚠️ Давхар uniqueness шалгалт — markVerified хийх агшинд өөр хэрэглэгч
    // тэр утсыг баталгаажуулсан байж болзошгүй (race).
    const owner = await this.prisma.user.findFirst({
      where: {
        phone: local.phone,
        phoneVerified: { not: null },
        id: { not: local.userId },
      },
      select: { id: true },
    });
    if (owner) {
      await this.prisma.phoneVerifySession
        .update({ where: { id: local.id }, data: { status: 'expired' } })
        .catch(() => {});
      throw new ConflictException('Энэ утасны дугаар өөр хэрэглэгчид бүртгэлтэй байна');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: local.userId },
      select: { phone: true, email: true, name: true },
    });

    // Session + User-г атомаар шинэчилнэ.
    await this.prisma.$transaction([
      this.prisma.phoneVerifySession.update({
        where: { id: local.id },
        data: { status: 'verified', verifiedAt: now },
      }),
      this.prisma.user.update({
        where: { id: local.userId },
        data: {
          phone: local.phone,
          phoneVerified: now,
          pendingPhone: null,
        },
      }),
    ]);

    // Audit (admin "Аккаунт түүх"-д харагдана) — fire-and-forget.
    this.prisma.userAuditLog
      .create({
        data: {
          userId: local.userId,
          field: 'phone',
          oldValue: user?.phone ?? null,
          newValue: local.phone,
          actor: 'self',
        },
      })
      .catch(() => {});

    // ⚠️ Имэйл мэдэгдэл — зөвхөн хүчинтэй (guest биш) имэйлд.
    if (user?.email) {
      this.email
        .sendPhoneVerified(user.email, user.name ?? null, local.phone)
        .catch((err) =>
          this.logger.warn(`sendPhoneVerified алдаа (${user.email}): ${err}`),
        );
    }

    // In-app аюулгүй байдлын мэдэгдэл (navbar 🔔) — fire-and-forget.
    this.notifications
      .create(local.userId, {
        title: 'Утас баталгаажлаа',
        body: `Таны "${local.phone}" дугаар амжилттай баталгаажлаа.`,
        type: 'security',
        link: '/profile',
      })
      .catch(() => null);

    this.logger.log(`Утас баталгаажлаа → user ${local.userId} | ${local.phone}`);
  }
}
