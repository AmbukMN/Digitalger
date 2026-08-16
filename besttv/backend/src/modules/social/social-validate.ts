import { SocialChannel } from '@prisma/client';

/**
 * НИЙТЛЭХЭЭС ӨМНӨХ ШАЛГАЛТ.
 *
 * ⚠️⚠️ ЯАГААД ЗОХИОХ ҮЕД ШАЛГАХ ВЭ: Meta-гийн алдаа нь нийтлэх
 * агшинд л гардаг — тэр үед админ аль хэдийн товлочихсон, шөнө
 * дундын пост чимээгүй унана. Зохиох үед барих нь цорын ганц зөв
 * арга (Buffer/Publer бүгд ингэдэг).
 *
 * ⚠️ Бүх хязгаар нь Meta-гийн АЛБАН ЁСНЫ баримтаас (2026-08):
 *   IG caption 2200 · зураг зөвхөн JPEG · max 8MB · 320-1440px
 *   харьцаа 4:5–1.91:1 · hashtag 30 · carousel max 10
 *   FB message 63206 (практикт 5000-аас урт нь ховор)
 */

/** IG caption — Meta-гийн хатуу хязгаар */
export const IG_CAPTION_MAX = 2200;
/** IG feed дээр «дэлгэрэнгүй» эвхэгдэх ойролцоо цэг */
export const IG_FOLD = 125;
/** FB постын хязгаар */
export const FB_MESSAGE_MAX = 63_206;
/** FB дээр «See more» эвхэгдэх ойролцоо цэг */
export const FB_FOLD = 477;
/** IG hashtag-ийн дээд тоо */
export const IG_HASHTAG_MAX = 30;
/** IG carousel-ийн дээд гишүүн */
export const IG_CAROUSEL_MAX = 10;

export interface ValidationIssue {
  channel: SocialChannel;
  /** `block` = нийтлэх БОЛОМЖГҮЙ · `warn` = болно ч анхаарах */
  level: 'block' | 'warn';
  message: string;
}

/** Текстээс hashtag тоолно (`#` дараа үсэг/тоо) */
function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/** Текстэд URL байгаа эсэх */
function hasLink(text: string): boolean {
  return /https?:\/\/\S+/i.test(text);
}

/**
 * Нэг сувгийн шалгалт.
 *
 * @param mediaCount R2-д хавсаргасан медиа тоо
 * @param hasVideo   Видео эсэх (IG-д Reels болно)
 */
export function validateChannel(params: {
  channel: SocialChannel;
  caption: string;
  mediaCount: number;
  hasVideo: boolean;
}): ValidationIssue[] {
  const { channel, caption, mediaCount, hasVideo } = params;
  const out: ValidationIssue[] = [];
  const add = (level: 'block' | 'warn', message: string) =>
    out.push({ channel, level, message });

  if (channel === SocialChannel.INSTAGRAM) {
    /**
     * ⚠️⚠️ ХАМГИЙН ЧУХАЛ ШАЛГУУР: Instagram нь ЗУРАГГҮЙ пост
     * ОГТ зөвшөөрдөггүй. Facebook дээр текст пост хэвийн байдаг
     * тул админ мартах нь маш түгээмэл.
     */
    if (mediaCount === 0) {
      add('block', 'Instagram-д зураг эсвэл видео ЗААВАЛ хэрэгтэй (текст ганцаараа болохгүй)');
    }

    if (mediaCount > IG_CAROUSEL_MAX) {
      add('block', `Instagram carousel дээд тал нь ${IG_CAROUSEL_MAX} зураг (одоо ${mediaCount})`);
    }

    if (caption.length > IG_CAPTION_MAX) {
      add(
        'block',
        `Instagram текст ${IG_CAPTION_MAX} тэмдэгтээс хэтэрсэн (одоо ${caption.length})`,
      );
    }

    const tags = countHashtags(caption);
    if (tags > IG_HASHTAG_MAX) {
      add('warn', `Hashtag ${tags} ширхэг — Instagram дээд тал нь ${IG_HASHTAG_MAX}`);
    }

    /**
     * ⚠️ IG caption доторх линк ДАРАГДДАГГҮЙ. Кино сайтад энэ нь
     * онцгой чухал: трейлерийн холбоос тавих нь утгагүй.
     */
    if (hasLink(caption)) {
      add('warn', 'Instagram-д caption доторх линк ДАРАГДАХГҮЙ — «bio-д линк» гэж бичихийг зөвлөе');
    }

    if (hasVideo) {
      /* ⚠️ Meta 2024-өөс IG видеог ЗӨВХӨН Reels болгодог */
      add('warn', 'Видео нь Reels хэлбэрээр орно (3 сек – 15 мин, max 300 MB)');
    }
  }

  if (channel === SocialChannel.FACEBOOK) {
    /* FB-д медиа заавал биш — текст ганцаараа болно */
    if (!caption.trim() && mediaCount === 0) {
      add('block', 'Facebook-д текст эсвэл медиа аль нэг нь байх ёстой');
    }
    if (caption.length > FB_MESSAGE_MAX) {
      add('block', `Facebook текст ${FB_MESSAGE_MAX} тэмдэгтээс хэтэрсэн`);
    }
    /**
     * ⚠️ ОЛОН ЗУРАГТАЙ FB пост — `attached_media` урсгал нь Meta-гийн
     * албан ёсны баримтад ОРООГҮЙ. Ажилладаг ч мэдэгдэлгүй өөрчлөгдөж
     * болзошгүй тул админд ил хэлнэ.
     */
    if (mediaCount > 1 && !hasVideo) {
      add('warn', 'Facebook олон зурагтай пост — Meta-гийн баримтгүй арга, амжилтгүй болж болзошгүй');
    }
  }

  return out;
}

/** Хоёр суваг зэрэг шалгах */
export function validatePost(params: {
  channels: SocialChannel[];
  captions: Partial<Record<SocialChannel, string>>;
  body: string;
  mediaCount: number;
  hasVideo: boolean;
}): ValidationIssue[] {
  return params.channels.flatMap((channel) =>
    validateChannel({
      channel,
      caption: params.captions[channel] ?? params.body,
      mediaCount: params.mediaCount,
      hasVideo: params.hasVideo,
    }),
  );
}
