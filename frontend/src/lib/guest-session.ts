// Зочин (guest) хэрэглэгчийн төхөөрөмж дэх хадгалалт.
//
// Зорилго: нэг төхөөрөмжөөс "Зочноор нэвтрэх" дарахад НУУЦ ҮГ ТОХИРУУЛААГҮЙ
// зочин account руугаа л дахин орох (шинэ зочин дахин үүсгэхгүй).
//
// ⚠️ Зочин нууц үг + имэйл тохируулж БҮРЭН хэрэглэгч болмогц localStorage-ийг
// БҮХЭЛД НЬ цэвэрлэнэ (forgetGuestSession). Учир нь:
//  - Бүрэн хэрэглэгч зөвхөн username/нууц үгээрээ нэвтрэх ёстой.
//  - Нэг компьютерийг олон хүн ашигладаг: эхний хүн зочноор худалдан авч,
//    имэйл+нууц үг үүсгээд гарвал, ДАРААГИЙН хүн "Зочноор нэвтрэх" дарахад
//    ШИНЭ зочин үүсэх ёстой (өмнөх хүний бүрэн бүртгэл рүү орох ёсгүй).
//
// Хадгалах өгөгдөл (localStorage['digitalger-guest']):
//   { userId, password }
//   - password: зочин үүсэх үед өгсөн tempPassword. Нэг л зочинд хамаарна.

const GUEST_KEY = 'digitalger-guest';

export interface GuestSession {
  userId: string;
  password?: string | null; // tempPassword
}

export function saveGuestSession(s: GuestSession) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(s));
  } catch {
    /* localStorage хаалттай байж болзошгүй — алгасна */
  }
}

export function loadGuestSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.userId) return parsed as GuestSession;
    return null;
  } catch {
    return null;
  }
}

export function clearGuestSession() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* алгасна */
  }
}

// Зочин нууц үг + имэйл тохируулж БҮРЭН хэрэглэгч болмогц дуудна.
// localStorage-ийг бүхэлд нь цэвэрлэснээр энэ зочин дахин "Зочноор нэвтрэх"-д
// сэргэхгүй (бүрэн хэрэглэгч зөвхөн username/нууц үгээрээ нэвтэрнэ), мөн
// дараагийн "Зочноор нэвтрэх" дарвал ШИНЭ зочин үүснэ.
export function forgetGuestSession() {
  clearGuestSession();
}
