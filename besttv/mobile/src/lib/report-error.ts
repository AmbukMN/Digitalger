import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE } from './api';

/**
 * АЛДААГ СЕРВЕРТ МЭДЭГДЭХ.
 *
 * ⚠️⚠️ ҮҮНГҮЙГЭЭР production дээр юу эвдэрснийг мэдэх ЯМАР Ч арга
 * байхгүй — хэрэглэгч гомдоллохоос нааш. Вэб дээр аль хэдийн байдаг
 * (`frontend/src/lib/report-error.ts`), аппад байгаагүй.
 *
 * ⚠️ ХЭЗЭЭ Ч ШИДЭХГҮЙ: алдаа мэдээлэх үйлдэл өөрөө алдаа гаргавал
 * хязгааргүй давталт үүсэх эрсдэлтэй.
 */

/** ⚠️ Нэг алдааг ДАХИН ДАХИН илгээхээс сэргийлнэ (сүүлийн 20) */
const recent = new Set<string>();

/** ⚠️ Богино хугацаанд их хэмжээгээр илгээхээс сэргийлнэ */
let sentInWindow = 0;
let windowStart = Date.now();

export async function reportError(
  err: unknown,
  extra?: { source?: string; path?: string; componentStack?: string | null },
): Promise<void> {
  try {
    const error = err instanceof Error ? err : new Error(String(err));
    const message = (error.message || 'Тодорхойгүй алдаа').slice(0, 500);

    /* ⚠️ Сүлжээний алдааг МЭДЭГДЭХГҮЙ — сүлжээгүй байх нь алдаа биш,
       мэдэгдэх гэж оролдоод бас унана (утгагүй давталт) */
    if (
      /Network request failed|Failed to fetch|timeout|aborted/i.test(message)
    ) {
      return;
    }

    /* ⚠️ Хугацааны цонх — минутанд 5-аас илүү илгээхгүй */
    const now = Date.now();
    if (now - windowStart > 60_000) {
      windowStart = now;
      sentInWindow = 0;
    }
    if (sentInWindow >= 5) return;

    /* ⚠️ Давхардлыг шүүнэ — нэг алдаа render бүрд давтагдаж болно */
    const key = `${extra?.source ?? ''}|${message}`;
    if (recent.has(key)) return;
    recent.add(key);
    if (recent.size > 20) {
      const first = recent.values().next().value;
      if (first !== undefined) recent.delete(first);
    }
    sentInWindow += 1;

    await fetch(`${API_BASE}/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      /* ⚠️ Токен ЗОРИУДААР явуулахгүй — endpoint нээлттэй, зочны
         алдаа ч адил чухал. Токен дуусч байгаа нь алдааны шалтгаан
         байж болох тул түүнээс хамаарах ёсгүй. */
      body: JSON.stringify({
        /**
         * ⚠️⚠️ ЗААВАЛ 'client' — backend-д `@IsIn(['client','server'])`.
         * 'mobile' илгээвэл 400 буцаана (бодит тестээр илэрсэн).
         * Мобайл эсэхийг `meta.platform`-оос ялгана.
         */
        source: 'client',
        message,
        stack: (error.stack ?? '').slice(0, 4000),
        path: extra?.path,
        meta: {
          /* ⚠️ Мобайл алдааг вэбээс ЯЛГАХ цорын ганц зам */
          app: 'mobile',
          reporter: extra?.source ?? 'mobile',
          platform: Platform.OS,
          osVersion: String(Platform.Version),
          appVersion: Constants.expoConfig?.version ?? null,
          componentStack: extra?.componentStack ?? null,
        },
      }),
      /* ⚠️ Timeout — муу сүлжээнд унжиж, аппын хаагдалтыг саатуулахгүй */
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* ⚠️ ЗОРИУДААР ЧИМЭЭГҮЙ — алдаа мэдээлэгч өөрөө алдаа гаргаж
       болохгүй (хязгааргүй давталт үүснэ) */
  }
}
