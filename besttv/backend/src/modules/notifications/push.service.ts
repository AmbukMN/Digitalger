import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ГАР УТАСНЫ PUSH МЭДЭГДЭЛ (Expo → FCM/APNs).
 *
 * ⚠️⚠️ ЯАГААД EXPO ВЭ: FCM (Android) болон APNs (iOS) хоёрыг ТУСАД нь
 * хэрэгжүүлэх шаардлагагүй — Expo нь хоёуланг нэг API-аар дамжуулна.
 * APNs сертификат, FCM түлхүүрийг EAS удирдана.
 *
 * ⚠️ Энэ нь `NotificationsService.create()`-ээс ДУУДАГДАНА — тэр нь
 * бүх мэдэгдлийн НЭГ цэг тул шинэ төрөл нэмэхэд push автоматаар явна.
 *
 * ⚠️ Push илгээх нь ХЭЗЭЭ Ч гол урсгалыг зогсоох ЁСГҮЙ: төлбөр
 * баталгаажсан ч push унасны улмаас алдаа буцаах нь утгагүй. Тиймээс
 * бүх алдааг барьж зөвхөн лог үлдээнэ.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Хэрэглэгчийн БҮХ идэвхтэй төхөөрөмж рүү илгээнэ.
   *
   * @param data Дарахад очих зам — `{ link: '/profile?tab=orders' }`
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId, enabled: true },
        select: { id: true, token: true },
      });
      if (!tokens.length) return;

      /* ⚠️ Хүчингүй хэлбэртэй токеныг ШҮҮНЭ — Expo нь бүх багцыг
         татгалзаж, бусад нь ч хүрэхгүй болно */
      const valid = tokens.filter((t) => Expo.isExpoPushToken(t.token));
      if (!valid.length) return;

      const messages: ExpoPushMessage[] = valid.map((t) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: data ?? {},
        /* ⚠️ `high` — стриминг мэдэгдэл цаг хугацаанд мэдрэмтгий
           (багц дуусах, төлбөр баталгаажих) */
        priority: 'high',
      }));

      await this.dispatch(messages, valid);
    } catch (e) {
      /* ⚠️ Гол урсгалыг ЗОГСООХГҮЙ */
      this.logger.warn(`Push илгээж чадсангүй (user=${userId}): ${String(e)}`);
    }
  }

  /**
   * Олон хэрэглэгч рүү нэг зэрэг (шинэ анги гарсан гэх мэт).
   *
   * ⚠️ Expo нь нэг хүсэлтэд 100 мессеж авдаг — `chunkPushNotifications`
   * өөрөө хуваана.
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<number> {
    if (!userIds.length) return 0;
    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId: { in: userIds }, enabled: true },
        select: { id: true, token: true },
      });
      const valid = tokens.filter((t) => Expo.isExpoPushToken(t.token));
      if (!valid.length) return 0;

      const messages: ExpoPushMessage[] = valid.map((t) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: data ?? {},
        priority: 'high',
      }));

      await this.dispatch(messages, valid);
      return valid.length;
    } catch (e) {
      this.logger.warn(`Бөөн push илгээж чадсангүй: ${String(e)}`);
      return 0;
    }
  }

  /**
   * ⚠️⚠️ ХҮЧИНГҮЙ ТОКЕН ЦЭВЭРЛЭХ.
   *
   * Хэрэглэгч аппаа устгавал Expo нь `DeviceNotRegistered` буцаана.
   * Цэвэрлэхгүй бол:
   *   · хүснэгт хязгааргүй хуримтлагдана
   *   · илгээх бүрд дэмий хүсэлт явна
   *   · Expo хэт олон алдаанд rate limit тавина
   */
  private async dispatch(
    messages: ExpoPushMessage[],
    tokens: { id: string; token: string }[],
  ): Promise<void> {
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
      } catch (e) {
        this.logger.warn(`Push багц илгээгдсэнгүй: ${String(e)}`);
      }
    }

    /* ⚠️ `tickets` нь `messages`-тэй ИЖИЛ дараалалтай — Expo баталгаажуулсан */
    const dead: string[] = [];
    tickets.forEach((t, i) => {
      if (t.status !== 'error') return;
      const code = t.details?.error;
      if (code === 'DeviceNotRegistered') {
        const id = tokens[i]?.id;
        if (id) dead.push(id);
      } else {
        this.logger.warn(`Push алдаа (${code ?? 'тодорхойгүй'}): ${t.message}`);
      }
    });

    if (dead.length) {
      await this.prisma.deviceToken.deleteMany({ where: { id: { in: dead } } });
      this.logger.log(`Хүчингүй push токен устгав: ${dead.length}`);
    }

    /* Амжилттай илгээсэн токенуудын `lastUsedAt` шинэчилнэ */
    const okIds = tokens.filter((_, i) => tickets[i]?.status === 'ok').map((t) => t.id);
    if (okIds.length) {
      await this.prisma.deviceToken.updateMany({
        where: { id: { in: okIds } },
        data: { lastUsedAt: new Date() },
      });
    }
  }
}
