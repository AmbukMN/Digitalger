'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * Тухайн хэсгийг СҮҮЛД ХАРСАН огноог авна — жагсаалтын мөрүүдэд "шинэ"
 * тэмдэглэгээ тавихад.
 *
 * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: sidebar badge нь "хэдэн шинэ" гэдгийг л хэлдэг.
 * Хэрэглэгч тэр хуудас руу орохоор badge цэвэрлэгддэг ч ЯГ АЛЬ мөр шинэ
 * болохыг мэдэхгүй. Энэ hook нь хуудас нээгдэх мөчид `lastSeenAt`-ыг
 * ЦЭЭЖЛЭЖ АВЧ, дараа нь `markSeen` дуудагдсан ч мөрийн тэмдэглэгээ
 * ХЭВЭЭР үлдэнэ (тухайн үзэлтийн турш).
 *
 * @returns `isNew(createdAt)` — тухайн бичлэг шинэ эсэх
 */
export function useNewSince(section: string) {
  /** Хуудас нээгдэх мөчид авсан lastSeenAt — үзэлтийн турш ӨӨРЧЛӨГДӨХГҮЙ */
  const [since, setSince] = useState<Date | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    // ⚠️ markSeen дуудагдахаас ӨМНӨ уншина — admin-shell нь pathname
    // өөрчлөгдөх үед markSeen хийдэг тул энэ hook эрт ажиллах ёстой
    api<Record<string, string | null>>('/admin/notifications/last-seen')
      .then((map) => {
        const v = map[section];
        setSince(v ? new Date(v) : null);
      })
      .catch(() => setSince(null));
  }, [section]);

  return (createdAt: string | Date): boolean => {
    if (!since) return false;
    const at = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    return at > since;
  };
}
