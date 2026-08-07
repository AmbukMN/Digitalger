import { toast } from 'sonner';

/**
 * Админы бичих үйлдлийг АЛДААНЫ БОЛОВСРУУЛАЛТТАЙ гүйцэтгэнэ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: админ панелийн 6+ газарт `await api(...)`
 * нь try/catch-ГҮЙ дуудагдаж байв (FAQ/жанр/купон/хуудас устгах,
 * идэвх toggle). Сүлжээ тасрах / 403 / 500 гарвал ЮУ Ч БОЛОХГҮЙ —
 * toast ч гарахгүй, мөр ч устахгүй. Админ "дарсан юмаа, болсон байх"
 * гэж бодоод цааш явна → дата зөрчилдөнө.
 *
 * ⚠️ Амжилтын toast-ыг ч НЭГ газраас — өмнө нь зарим үйлдэл дуугүй
 * өнгөрдөг байсан (`toggleActive` нь ямар ч мэдэгдэлгүй).
 *
 * @returns амжилттай эсэх — дуудагч тал `if (!ok) return` хийж болно
 */
export async function runMutation(
  fn: () => Promise<unknown>,
  opts: { success?: string; error?: string; onDone?: () => void } = {},
): Promise<boolean> {
  try {
    await fn();
    if (opts.success) toast.success(opts.success);
    opts.onDone?.();
    return true;
  } catch (e) {
    /* ⚠️ Backend-ийн мессежийг ХАРУУЛНА — "Алдаа гарлаа" гэсэн ерөнхий
       текст нь админд юу буруу болсныг хэлдэггүй (ж: "идэвхтэй түрээс
       байна" гэдгийг мэдэх ёстой) */
    toast.error(e instanceof Error && e.message ? e.message : (opts.error ?? 'Алдаа гарлаа'));
    return false;
  }
}
