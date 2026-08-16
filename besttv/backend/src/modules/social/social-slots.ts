/**
 * ДАРААЛЛЫН SLOT ТООЦОО (Buffer-ийн загвар).
 *
 * ⚠️⚠️ ГОЛ ОЙЛГОЛТ: slot бол «мөр» БИШ, ДАВТАГДАХ ЦАГИЙН ХУВААРЬ.
 * Админ «Да/Лх/Ба 19:00» гэж тохируулбал тэр нь ДОЛОО ХОНОГ ТУТАМ
 * давтагдана. Пост нэмэхэд «дараагийн сул slot» руу орно.
 *
 * ⚠️ Хуваарь өөрчлөгдөхөд `NEXT_AVAILABLE` постууд ШИНЭ цаг руу
 * дахин хуваарилагдана, `CUSTOM` постууд ХӨДӨЛДӨГГҮЙ (Buffer-ийн
 * баримтжсан зан төлөв).
 *
 * ⚠️⚠️ ЦАГИЙН БҮС: slot-ын `time` нь УЛААНБААТАРЫН цагаар бичигдэнэ
 * ("19:00"), харин DB-д UTC хадгална. Хоёрыг андуурвал постууд
 * 8 цагаар зөрнө.
 */

/** Монгол улсын цагийн бүс — UTC+8 (зуны цаг ХЭРЭГЛЭДЭГГҮЙ) */
const ULAANBAATAR_UTC_OFFSET_H = 8;

export interface SlotDef {
  /** 0 = Ням … 6 = Бямба */
  weekday: number;
  /** "19:00" — Улаанбаатарын цагаар */
  time: string;
}

/**
 * Улаанбаатарын орон нутгийн огноо/цагийг UTC болгоно.
 *
 * ⚠️ `new Date(...)` нь СЕРВЕРИЙН цагийн бүсээр тайлбарладаг тул
 * шууд ашиглаж БОЛОХГҮЙ — сервер UTC дээр ажилладаг ч хөгжүүлэлт
 * дээр өөр байж болно. Тиймээс гараар тооцно.
 */
function ubToUtc(year: number, month: number, day: number, hh: number, mm: number): Date {
  return new Date(Date.UTC(year, month, day, hh - ULAANBAATAR_UTC_OFFSET_H, mm, 0, 0));
}

/** UTC огноо → Улаанбаатарын {өдөр, цаг, минут} */
function utcToUb(d: Date) {
  const shifted = new Date(d.getTime() + ULAANBAATAR_UTC_OFFSET_H * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
  };
}

/**
 * Заасан цагаас хойших slot-уудыг дарааллаар нь гаргана.
 *
 * ⚠️ Хязгааргүй давталтаас сэргийлж 8 долоо хоногоор таслана —
 * slot цөөн (жишээ 1/долоо хоног) үед ч 8 пост хүртэл байрлана.
 *
 * @param slots  Тодорхойлсон хуваарь
 * @param from   Эндээс ХОЙШ (ихэвчлэн `now`)
 * @param limit  Хэдэн slot гаргах
 */
export function upcomingSlots(slots: SlotDef[], from: Date, limit: number): Date[] {
  if (!slots.length) return [];

  const out: Date[] = [];
  const start = utcToUb(from);

  /**
   * ⚠️ Хязгаарыг ДИНАМИК — `limit` их үед 8 долоо хоног хүрэлцэхгүй
   * (долоо хоногт 3 slot × 8 = 24 л гарна). Дээд тал нь 1 жил —
   * түүнээс цааш хайх нь утгагүй.
   */
  const maxDays = Math.min(365, Math.max(56, Math.ceil((limit / Math.max(1, slots.length)) * 7) + 14));

  for (let dayOffset = 0; dayOffset < maxDays && out.length < limit; dayOffset++) {
    const probe = new Date(
      Date.UTC(start.year, start.month, start.day + dayOffset, 12, 0, 0),
    );
    const weekday = probe.getUTCDay();

    const todays = slots
      .filter((s) => s.weekday === weekday)
      .map((s) => {
        const [hh, mm] = s.time.split(':').map(Number);
        return ubToUtc(
          probe.getUTCFullYear(),
          probe.getUTCMonth(),
          probe.getUTCDate(),
          hh,
          mm,
        );
      })
      /* ⚠️ ӨНГӨРСӨН цагийг алгасна — өнөөдрийн 19:00 нь 20:00 цагт утгагүй */
      .filter((d) => d.getTime() > from.getTime())
      .sort((a, b) => a.getTime() - b.getTime());

    for (const d of todays) {
      if (out.length >= limit) break;
      out.push(d);
    }
  }

  return out;
}

/**
 * ДАРААГИЙН СУЛ slot-ыг олно.
 *
 * ⚠️⚠️ «Сул» гэдэг нь ЭЗЛЭГДЭЭГҮЙ гэсэн үг. Аль хэдийн товлосон
 * постуудын цагийг хасаж тооцно — эс бөгөөс хоёр пост НЭГ цагт
 * давхцаж, Instagram-ийн rate limit-д ойртоно.
 *
 * @param taken Аль хэдийн эзлэгдсэн цагууд (UTC)
 */
export function nextFreeSlot(
  slots: SlotDef[],
  taken: Date[],
  from: Date = new Date(),
): Date | null {
  if (!slots.length) return null;

  /* ⚠️ Минутын нарийвчлалаар харьцуулна — секунд/мс зөрж болно */
  const takenKeys = new Set(taken.map((d) => Math.floor(d.getTime() / 60_000)));

  /* Эзлэгдсэн бүх slot-ыг алгасахын тулд илүү гаргаж авна */
  const candidates = upcomingSlots(slots, from, taken.length + 20);
  for (const c of candidates) {
    if (!takenKeys.has(Math.floor(c.getTime() / 60_000))) return c;
  }
  return null;
}

/**
 * Хуваарь өөрчлөгдөхөд `NEXT_AVAILABLE` постуудыг ДАХИН хуваарилна.
 *
 * ⚠️ Buffer-ийн зан төлөв: постуудын ДАРААЛАЛ хадгалагдана, зөвхөн
 * цаг нь шинэ slot руу шилжинэ. Тиймээс `postIds` нь одоогийн
 * `scheduledAt`-аар эрэмбэлэгдсэн байх ЁСТОЙ.
 *
 * @returns postId → шинэ цаг. Slot хүрэлцэхгүй бол тэр пост орохгүй.
 */
export function reassignSlots(
  slots: SlotDef[],
  postIds: string[],
  from: Date = new Date(),
  /**
   * ⚠️ Тодорхой цагаар товлосон (`CUSTOM`) постуудын цаг —
   * эдгээрийг АЛГАСНА. Эс бөгөөс нэг цагт хоёр пост давхцана.
   */
  taken: Date[] = [],
): Map<string, Date> {
  const out = new Map<string, Date>();
  if (!slots.length || !postIds.length) return out;

  const takenKeys = new Set(taken.map((d) => Math.floor(d.getTime() / 60_000)));
  /* ⚠️ Эзлэгдсэнийг алгасах тул ИЛҮҮ гаргаж авна */
  const times = upcomingSlots(slots, from, postIds.length + taken.length + 10).filter(
    (t) => !takenKeys.has(Math.floor(t.getTime() / 60_000)),
  );

  postIds.forEach((id, i) => {
    const t = times[i];
    if (t) out.set(id, t);
  });
  return out;
}
