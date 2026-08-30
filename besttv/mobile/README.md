# BestTV гар утасны апп

Expo (React Native) апп. Backend нь **besttv.us**-ийн одоо ажиллаж буй API.

> ⛔⛔ **Вэб хөндөгдөхгүй.** Дэлгэрэнгүйг [docs/PLAN.md](docs/PLAN.md)-ээс үз.

## Эхлүүлэх

```bash
cd besttv/mobile
npm install
npx expo start          # QR уншуулж Expo Go-гоор нээнэ
```

⚠️ `npm install` дээр peer dependency зөрчил гарвал `--legacy-peer-deps`
нэмнэ (expo-modules-core ↔ react-native-worklets).

## Бүтэц

```
app/                    expo-router — зам бүр нэг дэлгэц
  (tabs)/               5 таб: Нүүр · Кино · Дуртай · Хайх · Профайл
  title/[slug].tsx      Киноны дэлгэрэнгүй + ангийн жагсаалт
  watch/[id].tsx        Видео тоглуулагч (HLS)
  login.tsx             Нэвтрэх
  register.tsx          Бүртгүүлэх
src/
  lib/api.ts            API клиент — токен АВТОМАТААР шинэчилнэ
  lib/auth.tsx          Нэвтрэлтийн төлөв (Context)
  lib/queries.ts        TanStack Query hook-ууд
  lib/types.ts          API-ийн төрөл (production-оос шалгасан)
  components/           Дахин ашиглагдах UI
  theme.ts              Өнгө — ВЭБЭЭС хуулсан
docs/PLAN.md            Бүрэн төлөвлөгөө
```

## Хийгдсэн (ҮЕ 2 — үндсэн урсгал)

| Дэлгэц | Төлөв |
|---|---|
| Нүүр — баннер, үргэлжлүүлэх, жанрын эгнээ | ✅ |
| Каталог — шүүлт, infinite scroll | ✅ |
| Хайлт — debounce 350мс, галиг дэмжинэ | ✅ |
| Дуртай | ✅ |
| Профайл — багц, хэтэвч, гарах | ✅ |
| Киноны дэлгэрэнгүй + ангиуд | ✅ |
| Плеер — HLS, PiP, дэвсгэрт үргэлжлэх, явц хадгалах | ✅ |
| Нэвтрэх / бүртгүүлэх | ✅ |
| **Apple Sign-In** (iOS) | ✅ |
| **Багц авах — QPay + 22 банк** | ✅ |
| **Офлайн татах** — 100 анги, багц дуустал | ✅ |
| **Албадан шинэчлэлт** — эвдэрсэн хувилбарыг зогсооно | ✅ |
| **Мэдэгдлийн дэлгэц** | ✅ |
| **Данс устгах** (Apple 5.1.1v) | ✅ |

### Production дээр туршсан

```
✅ нүүр (8 баннер)        ✅ каталог (224 кино)
✅ хайлт                  ✅ дэлгэрэнгүй (57 анги)
✅ ҮНЭГҮЙ анги тоглоно    ✅ төлбөртэй анги 403
✅ дуртай                 ✅ үргэлжлүүлэх
✅ токен шинэчлэлт        ✅ гарах
```

⚠️ Мобайл нь `Origin` header илгээдэггүй тул CORS саад болохгүй нь
батлагдсан (`okhttp` User-Agent-аар туршсан).

## Дараа хийх (ҮЕ 1 backend + ҮЕ 3–5)

- [x] ~~**Push мэдэгдэл**~~ ✅ — `DeviceToken` + Expo Push
- [x] ~~**Apple Sign-In**~~ ✅ — `usesAppleSignIn` + `/auth/mobile/oauth`
- [x] ~~**Мобайл OAuth**~~ ✅ — `id_token` + JWKS баталгаажуулалт
- [x] ~~**`/mobile/*` тусдаа зам**~~ ✅ — 154 кино (18+ хассан)
- [ ] **Google нэвтрэлт** — `GOOGLE_MOBILE_CLIENT_IDS` тохируулах хэрэгтэй
- [x] ~~**Төлбөр**~~ ✅ — QPay + 22 банкны deeplink, алсаас унтраах тугтай
- [x] ~~**Офлайн татах**~~ ✅ — 100 анги, багц дуустал, heartbeat-аар хүчингүй
- [ ] Дүрсийг `@expo/vector-icons`-оор солих (одоо тэмдэгт)
- [ ] Sentry (алдаа барих)
- [ ] Дэмжлэгийн чат

## Дэлгүүрт илгээх

[docs/STORE.md](docs/STORE.md) — бүртгэл, EAS, дэлгэцийн зураг,
насны ангилал, татгалзвал яах.

## Анхаарах

⚠️ **`app.json` дахь `bundleIdentifier`** — `mn.besttv.app`. Apple
Developer бүртгэлд ижил байх ёстой.

⚠️ **Плеер** нь `Authorization` header-ээр HLS татдаг. Backend нь
playlist бүрд эрх шалгадаг тул токен хугацаа дуусвал видео тасарна —
`api.ts` автоматаар шинэчилдэг ч плеер дотор тусдаа бариул хэрэгтэй
болж магадгүй (урт кино).

⚠️⚠️ **iOS банкны deeplink** — `app.json`-ы `LSApplicationQueriesSchemes`-д
22 scheme бүртгэсэн. Заагаагүй scheme-д `canOpenURL` нь ҮРГЭЛЖ `false`
буцаадаг тул бүх банк бүдэг харагдана. Шинэ банк нэмэгдвэл энд ч нэмнэ
(жагсаалтыг QPay-ийн бодит хариунаас гаргасан).

⚠️ **Дэлгэцийн эргэлт** зөвхөн плеер дээр чөлөөтэй. Бусад дэлгэц босоо —
`watch/[id].tsx` гарахдаа буцааж түгждэг.

## ⚠️ Тохиргоо шаардлагатай (.env.production)

Эдгээрийг тохируулаагүй бол нэвтрэлт **аюулгүй хаагдана** (401):

```bash
# Apple Developer → Identifiers → App ID
APPLE_CLIENT_IDS=mn.besttv.app

# Google Cloud Console → OAuth 2.0 Client IDs (iOS + Android тус тусдаа)
GOOGLE_MOBILE_CLIENT_IDS=xxx.apps.googleusercontent.com,yyy.apps.googleusercontent.com

# Албадан шинэчлэлт / төлбөрийг алсаас удирдах
APP_MIN_VERSION=1.0.0
APP_PAYMENTS_ENABLED=true
```

⚠️ `aud` шалгалт нь эдгээрээс хамаарна — тохируулаагүй бол ДУРЫН аппын
токеноор нэвтрэх эрсдэлтэй тул зориуд хаасан.
