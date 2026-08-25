---
name: besttv-import-movie
description: |
  `D:\xplay_offline\<Киноны нэр>` фолдероос кино/цувралыг BestTV
  (besttv.us) production DB рүү бүрэн байршуулна — Title үүсгэх,
  постер/backdrop оруулах, ангиуд үүсгэх, видео upload + HLS
  хөрвүүлэлт, усан тэмдэг.
  Use when the user says «<киноны нэр> киног оруул», «xplay_offline
  доторх киног байршуул», or names a folder under xplay_offline.
---

# BestTV — offline фолдероос кино оруулах

## Эх өгөгдөл

Хэрэглэгч `D:\xplay_offline\` дор **киноны нэрээр** фолдер үүсгэдэг:

```
D:\xplay_offline\Группийн нуралт ба Жинхэнэ хайр\
  ├── info.txt                                   ← мета
  ├── poster.png                                 ← босоо постер
  ├── backdrop.png                               ← хэвтээ дэвсгэр
  ├── Группийн нуралт ба Жинхэнэ хайр - 01.mp4
  ├── Группийн нуралт ба Жинхэнэ хайр - 02.mp4
  └── … (- NN.mp4 дугаарлалт)
```

`info.txt` бүтэц (кирилл, `Нэр:` маягийн түлхүүр):

```
Нэр:        Группийн нуралт ба Жинхэнэ хайр
Он:         2026
Насны ангилал: 1+
Жанр:       Драм, Романтик, Адал явдалт
Ангийн тоо: 27
Эх сурвалж: XPLAY (mn.xplay.app), show_id=265

Тайлбар:
Баян айлын залуу өв залгамжлагч …
```

⚠️ `info.txt`-ээс **ЗӨВХӨН гурвыг** авна: **Нэр**, **Он**, **Тайлбар**.
Бусад мөрийг (жанр, насны ангилал, эх сурвалж) үл тоомсорлоно —
жанрыг BestTV-ийн өөрийн 4 жанраас сонгоно (доор).

## Шийдвэрийн дүрэм

| Нөхцөл | Үйлдэл |
|---|---|
| `- NN.mp4` файл **2+** | `type: SERIES` — 1 улирал + анги бүрд Episode |
| `- NN.mp4` файл **1** эсвэл дугаарлалтгүй ганц mp4 | `type: MOVIE` — Title-ийн `videoRawKey` |
| Анги 1–3 | `isFreePreview: true` (**эхний 3 анги ҮНЭГҮЙ**) |
| Бүх видео | усан тэмдэг **АСААЛТТАЙ** (`watermark: true`) |

## Тогтмолууд

```
API      https://besttv.us/api
Админ    admin@besttv.mn / Admin@12345
Жанр     cmsk4gl700001nn01taxlkr7h = Шилдэг кино
         cmsk1ahn400007s3gmsj41tej = Богино болон С-drama
         cms8kwwrm000a7s5cr9kkxlk5 = Монгол кино
         cms8kwwrm000e7s5cq53oftet = Насанд хүрэгчдийн
```

⚠️ **Жанрыг хэрэглэгчээс асуу** — `info.txt`-ийн жанр (Драм, Романтик…)
нь BestTV-ийн ангилалтай ТААРАХГҮЙ. Богино ангитай (2-5 мин) гадаад
цуврал бол ихэвчлэн «Богино болон С-drama».

⚠️ **`isPremium: true`** — өөрөөр заагаагүй бол төлбөртэй.

⚠️ **`isActive: false`-ээр эхэл**. Бүх анги `READY` болсны ДАРАА
идэвхжүүлнэ — эс бөгөөс хэрэглэгч хагас хөрвүүлсэн кино хараад
«эвдэрсэн» гэж гомдоллоно.

## Алхмууд

### 1. Фолдер шалгах

```bash
D="D:/xplay_offline/<НЭР>"
ls "$D"                 # poster/backdrop/info.txt байгаа эсэх
ls "$D"/*.mp4 | wc -l   # ангийн тоо
cat "$D/info.txt"
```

### 2. Токен авах

```bash
curl -s -X POST https://besttv.us/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@besttv.mn","password":"Admin@12345"}'
```

⚠️ Access token ~15 мин хүчинтэй. Урт upload-ын үед **дахин ав**
(эсвэл 401 ирвэл шинэчил).

### 3. Постер / backdrop оруулах

`POST /api/admin/uploads/image` — multipart form, талбар `file`.
Хариу: `{ key }`. Ижил хэлбэрээр backdrop.

### 4. Title үүсгэх

`POST /api/admin/titles`:

```json
{
  "title": "<Нэр>",
  "slug": "<латин галиг, жижиг үсэг, зураасаар>",
  "type": "SERIES",
  "description": "<info.txt Тайлбар>",
  "year": 2026,
  "isPremium": true,
  "isActive": false,
  "language": "SUB",
  "genreIds": ["<сонгосон жанр>"],
  "posterKey": "<3-р алхмын key>",
  "backdropKey": "<3-р алхмын key>",
  "watermark": true,
  "metaTitle": "<доорх дүрмээр>",
  "metaDescription": "<доорх дүрмээр>"
}
```

⚠️ `slug` нь ДАВХАРДАХГҮЙ байх ёстой — эхлээд
`GET /api/admin/titles?q=<нэр>`-ээр шалга.

⚠️⚠️ **SEO-г ЗААВАЛ өөрөө бөглө** — `metaTitle` / `metaDescription`.

Backend нь эдгээрийг АВТОМАТААР үүсгэдэггүй. Админ панелд бөглөгддөг
нь **client талын** `admin/src/lib/seo.ts` — API-аар үүсгэхэд огт
ажиллахгүй. Тиймээс API-аар оруулсан кино SEO-гүй үлдэнэ
(бодит алдаа: 164 киноноос 1 нь SEO-гүй байсан).

Ижил дүрмээр (`admin/src/lib/seo.ts` — нэг эх сурвалж):

```
metaTitle = "<Нэр> (<Он>) — BestTV дээр онлайнаар үзэх"
            ⚠️ 60 тэмдэгтээс урт бол "<Нэр> (<Он>) — BestTV"[:60]

metaDescription:
  тайлбар ≥80 тэмдэгт → тайлбар (160-аас урт бол [:157] + "...")
  богино/хоосон       → "<тайлбар> <Нэр> киног BestTV дээр өндөр
                         чанартай, зар сурталчилгаагүй үзээрэй."
```

⚠️ `language`: `MN` = монголоор ярианы дуу оруулсан/монгол кино,
   `SUB` = эх дуутай, монгол хадмалтай. Эргэлзвэл ХЭРЭГЛЭГЧЭЭС АСУУ —
   XPLAY-ийн богино цуврал ихэвчлэн монголоор шивэгдсэн (`MN`).

### 5. Улирал + ангиуд (зөвхөн SERIES)

```
POST /api/admin/titles/:id/seasons          → { number: 1 }
POST /api/admin/titles/seasons/:sid/episodes → { number: N, isFreePreview: N<=3 }
```

### 6. Видео байршуулах (анги бүрд / кинонд)

R2 multipart — гурван алхам:

```
POST /api/admin/uploads/video/multipart/init      { fileName }        → { key, uploadId }
POST /api/admin/uploads/video/multipart/urls      { key, uploadId, partNumbers[] }
     → presigned URL руу PUT (ETag цуглуул)
POST /api/admin/uploads/video/multipart/complete  { key, uploadId, parts[] }
POST /api/admin/uploads/video/complete            { target, targetId, rawKey }
```

- `target`: `episode` | `movie` | `trailer`
- Хэсгийн хэмжээ **≥5 MB** (сүүлийнхээс бусад), `partNumbers` нэг
  дуудалтад **дээд тал нь 50**
- `video/complete` дуудмагц HLS queue-д орж `streamStatus: PROCESSING`

⚠️ Дараалан хийнэ — 27 анги зэрэг илгээвэл сервер CPU дүүрнэ.
Хэрэглэгч кино encode хийж байж болзошгүй тул **2-3 зэрэг**-ээс
хэтрүүлэхгүй.

### 7. Хөрвүүлэлт хянах

```
GET /api/admin/titles/:id   → seasons[].episodes[].streamStatus
```

Бүгд `READY` болмогц:

```
PATCH /api/admin/titles/:id   { "isActive": true }
```

⚠️ `FAILED` гарвал `streamError`-ыг уншиж хэрэглэгчид мэдэгд —
чимээгүй алгасаж болохгүй.

## Тайлан

Дуусахад **заавал** мэдэгд:
- Title id / slug, ангийн тоо
- Үнэгүй анги (1–3)
- Хөрвүүлэлтийн төлөв
- Идэвхжүүлсэн эсэх

## Анхаарах

⚠️ Файлын нэр **кирилл + хоосон зайтай** — bash-д ЗААВАЛ хашилтад ав.

⚠️ Windows консол cp1252 — Python скриптэд
`sys.stdout.reconfigure(encoding='utf-8')`.

⚠️ Хэрэглэгчийн дүрэм: **тестийн дата үлдээхгүй**. Алдаа гарч
хагас үүссэн Title-ыг цэвэрлэ.

⚠️ **Юу ч устгахгүй** — хэрэглэгч тодорхой хэлээгүй бол.
