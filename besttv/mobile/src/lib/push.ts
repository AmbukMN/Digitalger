import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * ГАР УТАСНЫ PUSH МЭДЭГДЭЛ.
 *
 * ⚠️⚠️ Зөвшөөрөл АСУУХ ЦАГ нь чухал. Апп нээгдмэгц асуувал ихэнх
 * хэрэглэгч «Үгүй» дарна — тэгвэл дахин асуух боломжгүй (iOS нь нэг л
 * удаа зөвшөөрдөг). Тиймээс НЭВТЭРСНИЙ ДАРАА л асууна: тэр үед
 * хэрэглэгч аппыг үнэлж амжсан байна.
 */

/* ⚠️ Апп нээлттэй үед мэдэгдэл ХАРАГДАХ ёстой — эс бөгөөс чимээгүй
   ирээд хэрэглэгч анзаарахгүй */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Зөвшөөрөл асууж, токеныг backend-д бүртгэнэ.
 *
 * @returns Амжилттай бүртгэсэн токен, эсвэл `null`
 */
export async function registerPush(): Promise<string | null> {
  /* ⚠️ Симулятор/эмулятор дээр push ажиллахгүй — дэмий алдаа гаргахгүй */
  if (!Device.isDevice) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;

    /* ⚠️ Аль хэдийн татгалзсан бол ДАХИН асуухгүй — iOS хариу өгөхгүй,
       Android дээр эвгүй давтагдана */
    if (status !== 'granted') {
      const res = await Notifications.requestPermissionsAsync();
      status = res.status;
    }
    if (status !== 'granted') return null;

    /**
     * ⚠️⚠️ `projectId` ЗААВАЛ — EAS project-той холбогдоно. Байхгүй бол
     * `getExpoPushTokenAsync` алдаа шидэж push огт ажиллахгүй.
     * `app.json` → `extra.eas.projectId`-аас уншина.
     */
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      /* ⚠️ EAS project үүсгээгүй байна — dev горимд хэвийн */
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    /* ⚠️ Android-д суваг ЗААВАЛ — эс бөгөөс мэдэгдэл ЧИМЭЭГҮЙ ирнэ
       (Android 8+ дээр суваггүй мэдэгдэл харагдахгүй) */
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Мэдэгдэл',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E11D2E',
      });
    }

    await api('/notifications/push/register', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: Constants.expoConfig?.version,
        deviceName: Device.modelName ?? undefined,
      }),
    });

    return token;
  } catch {
    /* ⚠️ Push бүртгэл унасан ч апп ажиллах ЁСТОЙ — чимээгүй өнгөрнө */
    return null;
  }
}

/**
 * Гарахад токеныг устгана.
 *
 * ⚠️ Устгахгүй бол гарсан хэрэглэгчид (эсвэл шинэ эзэнд) өмнөх хүний
 * төлбөр/багцын мэдэгдэл ирсээр байна.
 */
export async function unregisterPush(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await api(`/notifications/push/${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {
    /* Сүлжээгүй ч гарах урсгал зогсох ёсгүй */
  }
}
