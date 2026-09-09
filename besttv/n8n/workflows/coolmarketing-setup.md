# Cool Marketing Agency — Facebook чатбот тохируулах заавар

⚠️ **Энэ бол ТАНЫ хийх ажлын жагсаалт.** n8n workflow, node-уудыг би
хийнэ. Танаас зөвхөн Facebook App-ийн тохиргоо + токен хэрэгтэй.

---

## Ойлгох гол зүйл

| Асуулт | Хариу |
|---|---|
| Шинэ FB App **үүсгэх үү**? | ⚠️ **ТИЙМ, ЗААВАЛ** — доор шалтгааныг тайлбарлав |
| BestTV/DigitalGer-т нөлөөлөх үү? | **ҮГҮЙ** — тусдаа App, тусдаа webhook зам, тусдаа node-ууд |
| AI credential | ✅ Одоо байгаа **OpenAI account** (`qpjrNb8Yo010i6C9`) шууд ашиглана |
| Database | ❌ Хэрэггүй — бэлэн хариулт (та өгсөн) |

### ⚠️⚠️ Яагаад ШИНЭ App заавал вэ

Facebook-ийн Page Access Token нь **App бүрд тусдаа** үүсдэг.
DigitalGer-ийн App-аар Cool Marketing хуудсанд токен авах гэвэл:

1. Тэр App-д Cool Marketing хуудсыг нэмэх шаардлагатай болно
2. Токен нэгдэж, App хоригдвол **гурвуулаа** зэрэг унтарна
3. Permission review нь App түвшинд явагддаг тул хольж болохгүй

**Тусдаа App = тусдаа эрсдэл.** DigitalGer/BestTV-д огт хүрэхгүй.

---

## 1-Р АЛХАМ — Facebook App үүсгэх

1. https://developers.facebook.com/apps → **Create App**
2. Use case: **Other** → Next
3. App type: **Business** → Next
4. App name: `Cool Marketing Chatbot`
   Contact email: `info@coolmarketing.mn`
   Business portfolio: Cool Marketing-ийн Business account (байвал)
5. **Create app** → нууц үгээ оруулна

### App ID / Secret хуулж авах
**App settings → Basic**:
```
App ID:     ____________________
App Secret: ____________________   (Show дарж хуулна)
```
⚠️ App Secret-ыг хэнд ч бүү өг — надад ч хэрэггүй (доор тайлбарлав).

---

## 2-Р АЛХАМ — Messenger бүтээгдэхүүн нэмэх

1. Зүүн цэс → **Add Product** → **Messenger** → Set up

### 2.1 Хуудас холбох
**Messenger → Settings → Access Tokens**:
1. **Add or remove Pages** → `Cool Marketing Agency` сонгоно
2. Эрх асуухад **бүгдийг зөвшөөрнө**
3. Хуудас жагсаалтад гармагц → **Generate Token**
4. Токеныг хуулна:

```
Page Access Token: ____________________________________________
Page ID:           ____________________
```

⚠️⚠️ **ТОКЕН НЬ ХУГАЦААГҮЙ БАЙХ ЁСТОЙ.**
Generate хийсэн токен нь ихэвчлэн богино хугацаатай. Шалгах арга:
https://developers.facebook.com/tools/debug/accesstoken/ → токеноо
буулгаад **Expires** мөрийг харна.

- `Never` бол ✅ зөв
- Огноо харагдвал ⛔ → доорх аргаар мөнхийн токен ав:
  1. Тэр хуудсан дээр **Extend Access Token** дарна
  2. Гарч ирсэн урт токеноор дараах хаягийг browser-т нээнэ:
     ```
     https://graph.facebook.com/v21.0/me/accounts?access_token=<УРТ_ТОКЕН>
     ```
  3. Хариунаас Cool Marketing хуудасны `access_token`-ыг ав — тэр нь
     мөнхийн (`expires_at: 0`)

### 2.2 Webhook тохируулах
**Messenger → Settings → Webhooks** → **Add Callback URL**:

```
Callback URL:  https://bot.digitalger.mn/webhook/coolmarketing-webhook
Verify Token:  CoolMarketing2026Verify
```

⚠️ **Verify Token** нь ЯГ дээрхтэй ижил байх ёстой — би n8n талд
үүнийг тавьсан. Нэг үсэг зөрвөл «couldn't be validated» гэж алдана.

⚠️ **Verify дарахаас ӨМНӨ надад хэлээрэй** — n8n workflow идэвхтэй
байх ёстой, эс бөгөөс шалгалт унана.

**Verify and save** амжилттай болсны дараа → **Add subscriptions**:

| Талбар | Заавал | Тайлбар |
|---|---|---|
| `messages` | ✅✅ | Хэрэглэгчийн зурвас |
| `messaging_postbacks` | ✅ | Товч дарсан |
| **`feed`** | ✅✅ | ⚠️ **Пост дээрх СЭТГЭГДЭЛ** — автомат хариу + DM-д ЗААВАЛ |
| `messaging_optins` | ⬜ | Хэрэггүй |
| `message_deliveries` | ⬜ | Хэрэггүй (шуугиан ихэсгэнэ) |
| `message_reads` | ⬜ | Хэрэггүй |

⚠️⚠️ **`feed` нь БҮХ үйл явдлыг илгээдэг** (лайк, шинэ пост, share,
сэтгэгдэл…). n8n тал дээр би зөвхөн `item: "comment"` +
`verb: "add"`-ыг шүүж авна — бусдыг чимээгүй алгасна.

---

## 3-Р АЛХАМ — Permission (App Review)

### Тест үед (одоо) — review ХЭРЭГГҮЙ
App нь **Development** горимд байхад **та өөрөө болон App-д нэмсэн
хүмүүс** чатлахад ажиллана. Эхлээд ингэж туршина.

**App roles → Roles**-д өөрийгөө Administrator-оор нэмээд туршина.

### Нийтэд гаргахад (Live) — эдгээр permission шаардана

**App Review → Permissions and Features** цэсээс:

| Permission | Заавал | Юунд |
|---|---|---|
| `pages_messaging` | ✅✅ **ЗААВАЛ** | Зурвас хүлээн авах/илгээх. Үүнгүйгээр чатбот ОГТ ажиллахгүй |
| `pages_manage_metadata` | ✅ | Webhook subscribe хийх |
| `pages_show_list` | ✅ | Хуудасны жагсаалт унших (токен авахад) |
| `pages_read_engagement` | ✅✅ **ЗААВАЛ** | ⚠️ **Сэтгэгдэл унших** — `feed` webhook-ийн агуулга авахад. Үүнгүйгээр сэтгэгдлийн текст ирэхгүй |
| `pages_manage_engagement` | ✅✅ **ЗААВАЛ** | ⚠️ **Сэтгэгдэлд хариу бичих** (`Танд чатаар мэдээлэл илгээлээ!`) |
| `Business Asset User Profile Access` | ✅ **ЗААВАЛ** | Хэрэглэгчийн **нэр/аватар** авах. Та «нэрээр нь мэндчилнэ» гэж сонгосон тул шаардлагатай. ⚠️ Энэ нь Feature (Permission БИШ) — App Review-д тусдаа хэсэгт байдаг |

⚠️⚠️ **App Review-д юу бэлдэх вэ:**

1. **Screencast (видео)** — заавал. Дараахыг бичнэ:
   - Facebook хуудсандаа орж зурвас бичих
   - Чатбот хариулж байгааг харуулах
   - Quick reply товч дарж шинэ хариу авах
   - Carousel (хийсэн ажлууд) харагдахыг үзүүлэх
   - ⚠️ **Пост дээр сэтгэгдэл бичих** → автомат хариу гарахыг харуулах
   - ⚠️ Тэр хүнд **хувийн зурвас** очсоныг харуулах
2. **Тайлбар бичих** (англиар):
   ```
   Our chatbot answers customer questions about our web development
   services on our Facebook Page.

   - pages_messaging: receive and reply to customer messages.
   - pages_read_engagement: read comments left on our own posts.
   - pages_manage_engagement: post a short public reply to those
     comments and send the commenter a private message with our
     service information.

   All content is our own business information. No message data is
   stored or shared with third parties beyond generating the reply.
   ```
3. **Privacy Policy URL** — заавал шаардана:
   `https://www.coolmarketing.mn/privacy` ← ⚠️ Энэ хуудас **байх ёстой**.
   Байхгүй бол App Review татгалзана. Хэрэв байхгүй бол надад
   хэлээрэй — DigitalGer-ийнхтэй ижил хэлбэрээр хийж өгье.

⚠️ Review 3-7 хоног үргэлжилдэг. Тэр хугацаанд Development горимд
өөрөө туршиж болно.

---

## 4-Р АЛХАМ — Надад өгөх зүйлс

Дараах 3 зүйлийг надад өгвөл би n8n-д тохируулна:

```
1. Page Access Token: EAA...      ← 2.1-ээс (мөнхийн эсэхийг шалгасан)
2. Page ID:           1234567890  ← 2.1-ээс

3. ЗУРАГ ×3 (чатаар файлаар өгнө — би R2-д байршуулж нийтийн URL болгоно):
   ├─ «Манай харилцагчид»  — түнш байгууллагуудын лого (SS2)
   ├─ «Ерөнхий мэдээлэл»   — ВЭБ САЙТ ХИЙХ ҮЙЛЧИЛГЭЭ баннер (SS3)
   └─ «Үнийн санал»        — үнэ бичсэн JPG

4. ХИЙСЭН АЖИЛ ×6:
   ├─ Зураг (файл эсвэл URL)
   ├─ Гарчиг     (≤ 80 тэмдэгт — FB хязгаар)
   ├─ Тайлбар    (≤ 80 тэмдэгт — FB хязгаар)
   └─ Холбоос    (шинэ табд нээгдэнэ)
```

⚠️ **FB-ийн хатуу хязгаарууд** (мэдэж байх нь зүйтэй):
| Зүйл | Хязгаар |
|---|---|
| Carousel карт | дээд тал нь **10** (бид 6) |
| Картын гарчиг | **80** тэмдэгт |
| Картын тайлбар | **80** тэмдэгт |
| Quick reply товч | дээд тал нь **13**, гарчиг **20** тэмдэгт |
| Зурагны харьцаа | **1.91:1** (1200×628 хамгийн зөв) |
| Текст зурвас | **2000** тэмдэгт |

⚠️ **App Secret надад ХЭРЭГГҮЙ** — webhook-ийн гарын үсэг шалгахад
хэрэглэдэг ч n8n тал дээр Verify Token-оор хамгаалагдана.

⚠️ **Хийсэн ажлын зураг** — 1.91:1 харьцаатай (жишээ: 1200×628)
байвал хамгийн зөв. Квадрат зураг ч болно, гэхдээ хажуу тал нь
тайрагдана.

---

## Би юу хийх вэ (та тохируулсны дараа)

### n8n workflow: `Cool Marketing — Facebook чатбот`
⚠️ **Бүх node ШИНЭ**, BestTV/DigitalGer-ийнхийг ОГТ хөндөхгүй.

```
CM Verify (GET) ──→ Respond Challenge          (webhook шалгалт)

CM Message (POST) ─→ CM Parse ─→ Typing On ─→ AI Agent ─→ Build Reply
                                                 ↑              │
                                    OpenAI Chat Model           ├→ Send Text (+ quick reply)
                                    (одоо байгаа credential)     └→ Has Carousel? ─→ Send Carousel
```

### Хариултын 4 хэсэг (таны заасны дагуу)

| Хэсэг | Агуулга | Quick reply товчнууд |
|---|---|---|
| **Ерөнхий мэдээлэл** | Вэб сайтын төрлүүд + үйлчилгээ + бэлэг (SS3 зурагтай) | Үнийн санал · Хийсэн ажлууд · Холбоо барих |
| **Үнийн санал** | (та өгнө) | Ерөнхий мэдээлэл · Хийсэн ажлууд · Холбоо барих |
| **Хийсэн ажлууд** | Carousel — 6 карт | Ерөнхий мэдээлэл · Үнийн санал · Холбоо барих |
| **Холбоо барих** | Хаяг, утас, вэб, имэйл | Ерөнхий мэдээлэл · Үнийн санал · Хийсэн ажлууд |
| **Манай харилцагчид** | SS2 зураг + «Манай харилцагчид» гарчиг | Ерөнхий мэдээлэл · Хийсэн ажлууд · Холбоо барих |

⚠️ **Шийдвэрлэсэн (2026-09-09):**
- Quick reply нь **5 товч** — Ерөнхий мэдээлэл · Үнийн санал ·
  Хийсэн ажлууд · Холбоо барих · Манай харилцагчид.
  Тухайн хуудсан дээрээ байгаа товч нь харагдахгүй (үлдсэн 4 гарна).
- **Үнийн санал** = үнэ бичсэн **JPG зураг** (текст биш)
- **Нэрээр мэндчилнэ** → `Business Asset User Profile Access`
  permission ЗААВАЛ (App Review-д нэмж мэдүүлнэ)

### Сэтгэгдлийн автомат хариу (2026-09-09 нэмэв)

```
CM Message (POST) ─→ CM Parse Comments ─→ Send Comment Reply ─→ Send Private Reply
                        (feed шүүлт)         «Танд чатаар            (ерөнхий
                                            мэдээлэл илгээлээ!»      мэдээлэл)
```

⚠️⚠️ **FB-ийн Private Reply дүрэм:**
- Сэтгэгдэл бүрд **НЭГ Л УДАА** хувийн зурвас илгээж болно
- **7 хоногийн дотор**
- Хоёр дахь оролдлого алдаа өгнө → кодод давхардлын хамгаалалт заавал
- ⚠️ Хуудас өөрөө бичсэн сэтгэгдэлд хариулахгүй (`from.id === PAGE_ID`)

### AI-гийн хил хязгаар
- ✅ Зөвхөн **бүтээгдэхүүн, үнийн санал, хийсэн ажил, холбоо барих**
- ✅ Ойлгомжгүй асуултад: «Та ямар төрлийн вэбсайт сонирхож байна вэ?»
  гэх мэт **эелдэг чиглүүлэлт**
- ⛔ Сэдвээс гадуур юм ярихгүй, зохиохгүй
- ⛔ Үнэ өөрөө таамаглахгүй (та өгсөн үнийг л хэлнэ)

---

## Тэмдэглэл — юу ХӨНДӨХГҮЙ

- ⛔ DigitalGer-ийн `facebook-webhook` зам
- ⛔ BestTV-ийн `besttv-facebook-webhook` зам
- ⛔ Тэдгээрийн node, токен, credential
- ✅ Зөвхөн `coolmarketing-webhook` зам — шинэ
- ✅ OpenAI credential нь **хуваалцсан** (унших л, өөрчлөхгүй)
