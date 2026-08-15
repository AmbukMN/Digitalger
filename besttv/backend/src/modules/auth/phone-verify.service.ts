import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../../common/phone';
import { NotificationsService } from '../notifications/notifications.module';
import { VerifyMnService } from './verify-mn.service';

export type PhoneVerifyStatus = 'pending' | 'verified' | 'expired';

/**
 * УТАС БАТАЛГААЖУУЛАХ — verify.mn MO SMS.
 *
 * ⚠️⚠️ Урсгал (OTP-ЭЭС ӨӨР):
 *   1. Бид 6 оронтой код үүсгэнэ
 *   2. Хэрэглэгч тэр кодыг ӨӨРИЙН утаснаас 144773 руу SMS-ээр илгээнэ
 *   3. verify.mn ирсэн SMS-ийн дугаарыг session-тэй тааруулна
 *   4. Бид polling-оор (эсвэл callback дохиогоор) мэдэж авна
 *
 * Ингэснээр дугаар нь ҮНЭХЭЭР тухайн хүнийх гэдэг батлагдана — кодыг
 * хулгайлсан ч өөр дугаараас илгээвэл таарахгүй.
 */
@Injectable()
export class PhoneVerifyService {
  private readonly logger = new Logger(PhoneVerifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly verifyMn: VerifyMnService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Баталгаажуулах хүсэлт — verify.mn session үүсгэж заавар буцаана.
   */
  async requestPhoneVerify(userId: string, rawPhone: string) {
    if (!this.verifyMn.isConfigured()) {
      throw new BadRequestException(
        'Утас баталгаажуулах үйлчилгээ түр ажиллахгүй байна. Дараа оролдоно уу.',
      );
    }

    /* ⚠️ НОРМАЛЧЛАЛ ЗААВАЛ — «+976 9900-1122» ба «99001122» нь НЭГ
       дугаар. Үүнгүйгээр давхардлын шалгалт утгагүй болно. */
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      throw new BadRequestException(
        'Утасны дугаар буруу байна (8 оронтой, 5-9-өөр эхэлсэн байх ёстой)',
      );
    }

    /**
     * ⚠️ Зөвхөн БАТАЛГААЖСАН дугаар давхардахыг хориглоно.
     *
     * Баталгаажаагүй давхцлыг зөвшөөрөх нь ЗОРИУД: хэн нэгэн бусдын
     * дугаарыг бүртгэчихээд эзэн нь баталгаажуулж чадахгүй болох
     * байдлаас сэргийлнэ. Хэн эхэлж БАТАЛГААЖУУЛСАН нь эзэмшинэ.
     */
    const owner = await this.prisma.user.findFirst({
      where: { phone, phoneVerified: { not: null }, id: { not: userId } },
      select: { id: true },
    });
    if (owner) {
      throw new ConflictException('Энэ утасны дугаар өөр хэрэглэгчид бүртгэлтэй байна');
    }

    /**
     * ⚠️⚠️ ХУУЧИН PENDING SESSION-ЫГ ДАХИН АШИГЛАНА.
     *
     * verify.mn-д session бүр ЗАРДАЛТАЙ. Хэрэглэгч диалог хааж дахин
     * нээвэл шинэ SMS session үүсгэх нь дэмий зардал. Мөн «60 секунд
     * хүлээнэ үү» гэсэн алдаа заахаас илүү зүгээр л ижил кодыг
     * буцаах нь хэрэглэгчид ойлгомжтой.
     */
    const reusable = await this.prisma.phoneVerifySession.findFirst({
      where: { userId, phone, status: 'pending', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    const shortcode = this.config.get<string>('verifyMn.shortcode') ?? '144773';

    if (reusable) {
      return {
        sessionId: reusable.verifyMnSessionId,
        code: reusable.code,
        shortcode,
        smsUri: `sms:${shortcode}?body=${encodeURIComponent(reusable.code)}`,
        displayInstruction: `${shortcode} дугаарт "${reusable.code}" гэж SMS илгээнэ үү`,
        expiresAt: reusable.expiresAt.toISOString(),
      };
    }

    /* Хуучин pending-үүдийг хаана — нэг л идэвхтэй session байна */
    await this.prisma.phoneVerifySession.updateMany({
      where: { userId, status: 'pending' },
      data: { status: 'expired' },
    });

    /* ⚠️ `randomInt` — `Math.random()` БИШ (криптографийн хувьд найдвартай) */
    const code = String(crypto.randomInt(100000, 999999));

    /**
     * ⚠️⚠️ CALLBACK КОРРЕЛЯЦИ — хамгийн нарийн хэсэг.
     *
     * verify.mn-ий callback нь БИЕГҮЙ ирдэг. Мөн verify.mn-ий
     * sessionId-г урьдчилж мэдэх БОЛОМЖГҮЙ (POST хариунаас л ирнэ)
     * тул callback URL-д түүнийг суулгаж чадахгүй.
     *
     * Шийдэл: ӨӨРИЙН UUID-г урьдчилан үүсгээд `?sid=`-д суулгана.
     * Тэр UUID нь `PhoneVerifySession.id` болно.
     */
    const localSessionId = crypto.randomUUID();
    const callbackBase = this.config.get<string>('verifyMn.callbackUrl') ?? null;
    const callbackUrl = callbackBase
      ? `${callbackBase}${callbackBase.includes('?') ? '&' : '?'}sid=${encodeURIComponent(localSessionId)}`
      : null;

    const session = await this.verifyMn.createSession(phone, code, callbackUrl);

    await this.prisma.phoneVerifySession.create({
      data: {
        id: localSessionId,
        userId,
        phone,
        code,
        verifyMnSessionId: session.sessionId,
        status: 'pending',
        /* ⚠️ Хугацааг verify.mn ӨӨРӨӨ тогтооно — бид таамаглахгүй */
        expiresAt: new Date(session.expiresAt),
      },
    });

    /* ⚠️ Баталгаажтал `User.phone` СОЛИХГҮЙ — зөвхөн `pendingPhone` */
    await this.prisma.user
      .update({ where: { id: userId }, data: { pendingPhone: phone } })
      .catch(() => null);

    return {
      sessionId: session.sessionId,
      code,
      shortcode,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    };
  }

  /** Polling — frontend 3 секунд тутам дуудна */
  async getStatus(
    userId: string,
    verifyMnSessionId: string,
  ): Promise<{ status: PhoneVerifyStatus }> {
    /* ⚠️ `userId`-аар хязгаарлана — бусдын session-ыг шалгаж болохгүй */
    const local = await this.prisma.phoneVerifySession.findFirst({
      where: { verifyMnSessionId, userId },
    });
    if (!local) throw new NotFoundException('Session олдсонгүй');
    return this.resolveSession(local);
  }

  /**
   * verify.mn-ий callback — зөвхөн «сэрээх дохио».
   *
   * ⚠️⚠️ Дуудагчийн үгэнд ИТГЭХГҮЙ. Callback ирсэн ч заавал
   * `getSessionStatus`-аар ДАХИН баталгаажуулна (`resolveSession`
   * дотор). Эс бөгөөс хэн нэгэн callback URL-ыг таамаглаж дуудаад
   * бусдын дугаарыг «баталгаажуулах» боломжтой болно.
   */
  async handleCallback(localSessionId: string): Promise<void> {
    if (!localSessionId) return;
    const local = await this.prisma.phoneVerifySession.findUnique({
      where: { id: localSessionId },
    });
    if (!local) {
      this.logger.warn(`Callback — session олдсонгүй (sid=${localSessionId})`);
      return;
    }
    await this.resolveSession(local).catch((err) =>
      this.logger.error(`Callback resolve алдаа: ${String(err)}`),
    );
  }

  /**
   * Төлвийг verify.mn-ээс шалгаж шинэчилнэ.
   * ⚠️ Аль хэдийн дууссан бол verify.mn руу дахин ЯВАХГҮЙ (429 болон
   * дэмий зардлаас хамгаална).
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
        .catch(() => null);
      return { status: 'expired' };
    }
    return { status: 'pending' };
  }

  /** Баталгаажуулалтыг бүртгэж, дугаарыг эзэмшүүлнэ */
  private async markVerified(local: {
    id: string;
    userId: string;
    phone: string;
  }): Promise<void> {
    const now = new Date();

    /**
     * ⚠️⚠️ ДАВХАР ШАЛГАЛТ (race) — хүсэлт үүсгэснээс хойш баталгаажих
     * хүртэлх хугацаанд ӨӨР хэрэглэгч тэр дугаарыг баталгаажуулсан
     * байж болно. Шалгахгүй бол `@unique` зөрчигдөж транзакц унана.
     */
    const owner = await this.prisma.user.findFirst({
      where: { phone: local.phone, phoneVerified: { not: null }, id: { not: local.userId } },
      select: { id: true },
    });
    if (owner) {
      await this.prisma.phoneVerifySession
        .update({ where: { id: local.id }, data: { status: 'expired' } })
        .catch(() => null);
      throw new ConflictException('Энэ утасны дугаар өөр хэрэглэгчид бүртгэлтэй байна');
    }

    /* ⚠️ Транзакц — session ба User ЗААВАЛ хамт шинэчлэгдэнэ */
    await this.prisma.$transaction([
      this.prisma.phoneVerifySession.update({
        where: { id: local.id },
        data: { status: 'verified', verifiedAt: now },
      }),
      this.prisma.user.update({
        where: { id: local.userId },
        data: { phone: local.phone, phoneVerified: now, pendingPhone: null },
      }),
    ]);

    /* Хонхны мэдэгдэл — аюулгүй байдлын чухал үйл явдал */
    this.notifications.create(
      local.userId,
      NotificationType.INFO,
      'Утас баталгаажлаа',
      `Таны ${local.phone} дугаар амжилттай баталгаажлаа.`,
      '/profile',
    );

    this.logger.log(`Утас баталгаажлаа → user=${local.userId} phone=${local.phone}`);
  }
}
