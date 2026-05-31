// Зочин (guest) хэрэглэгчийн төхөөрөмж дэх хадгалалт.
//
// Зорилго: нэг төхөөрөмжөөс "Зочноор нэвтрэх" дарахад өмнө үүсгэсэн зочин
// account руугаа л дахин ороx (шинэ зочин дахин үүсгэхгүй).
//
// Хадгалах өгөгдөл (localStorage['digitalger-guest']):
//   { userId, password, hasPassword }
//   - password:    зочин үүсэх үед өгсөн tempPassword. Нууц үг тохируулсны
//                  дараа УСТГАНА (буруу tempPass-аар нэвтрэхгүйн тулд).
//   - hasPassword: зочин өөрөө нууц үг тохируулсан эсэх. true бол "Зочноор
//                  нэвтрэх" дарахад нууц үг асууна (өөрийн мэдэх нууц үгээр).

const GUEST_KEY = 'digitalger-guest';

export interface GuestSession {
  userId: string;
  password?: string | null; // tempPassword (нууц үг тохируулсны дараа null)
  hasPassword?: boolean;     // зочин өөрөө нууц үг тохируулсан эсэх
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

// Зочин өөрөө нууц үг тохируулмагц дуудна: tempPassword-ийг УСТГАЖ,
// hasPassword:true болгоно. Ингэснээр дараа "Зочноор нэвтрэх" дарвал
// нууц үг асуух popup гарна (буруу tempPass-аар нэвтрэхгүй).
export function markGuestHasPassword() {
  const cur = loadGuestSession();
  if (!cur) return;
  saveGuestSession({ userId: cur.userId, password: null, hasPassword: true });
}
