import { toast } from 'sonner';
import { api } from './api';

/**
 * Админы CSV татах — НЭГ ЭХ СУРВАЛЖ.
 *
 * ⚠️⚠️ ЯАГААД ВЭ: Blob үүсгэх → `createObjectURL` → нуугдмал `<a>` →
 * `revokeObjectURL` → toast гэсэн 20 мөр `payments/page.tsx` болон
 * `email/page.tsx` хоёрт ҮГ ҮСЭГГҮЙ ижил хуулагдсан байв. Ялгаа нь
 * зөвхөн endpoint ба файлын нэр. Гурав дахь хуудсанд export нэмэх
 * бүрд дахин хуулагдана.
 *
 * ⚠️ `revokeObjectURL` ЗААВАЛ — эс бөгөөс blob санах ойд үлдэж, олон
 * удаа татахад хуудас хүндэрнэ.
 *
 * @param endpoint  `{ csv, count }` буцаадаг админ зам (query-тэйгээ)
 * @param baseName  Файлын нэрийн үндэс — огноо автоматаар нэмэгдэнэ
 * @returns амжилттай эсэх (дуудагч `finally`-д спиннер унтраана)
 */
export async function downloadCsv(endpoint: string, baseName: string): Promise<boolean> {
  try {
    const res = await api<{ csv: string; count: number }>(endpoint);

    /* ⚠️ BOM (﻿) — Excel нь UTF-8 гэдгийг таньж, кирилл үсэг
       эвдэрдэггүй болно (BOM-гүй бол "Ð¢Ó©Ð»Ð±Ó©Ñ€" гэж гарна) */
    const blob = new Blob(['﻿' + res.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`${res.count} мөр татагдлаа`);
    return true;
  } catch (e) {
    toast.error(e instanceof Error && e.message ? e.message : 'Татахад алдаа гарлаа');
    return false;
  }
}

/**
 * Шүүлтийн объектыг query string болгоно.
 *
 * ⚠️ Хуудаслалт/эрэмбийн талбарыг ХАСНА — export нь шүүсэн БҮХ мөрийг
 * татдаг тул `page`/`limit` утгагүй, харин `sort`/`dir` нь сервер талын
 * эрэмбэтэй давхцаж будлиан үүсгэнэ.
 */
export function filtersToQuery(
  /* ⚠️ `Record<string, unknown>` БИШ — интерфейс төрлүүд (PaymentFilters
     г.м.) index signature-гүй тул тэнд таарахгүй. `object` нь бүх
     объектыг хүлээж авна, `Object.entries` нь ямар ч байсан ажиллана. */
  filters: object,
  skip: string[] = ['page', 'limit', 'sort', 'dir'],
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (!v || v === 'ALL' || skip.includes(k)) continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}
