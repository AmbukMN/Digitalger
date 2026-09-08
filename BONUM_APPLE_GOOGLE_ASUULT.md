# Bonum-д илгээх тодруулах асуулт (Apple Pay / Google Pay)

> Bonum support: +976 7200-5000 / merchant.bonum.mn / имэйлээр

Сайн байна уу. DigitalGer.mn (Terminal ID: 17173069) дээр Bonum Gateway төлбөрийн системийг
нэвтрүүлж байна. Apple Pay болон Google Pay-тэй холбоотой дараах зүйлсийг тодруулна уу:

## 1. Hosted checkout (followUpLink) дээр Apple/Google Pay
`POST /bonum-gateway/ecommerce/invoices` -ээр invoice үүсгээд `followUpLink`
(ecommerce.bonum.mn) руу redirect хийхэд, тэр hosted хуудсан дээр **Apple Pay болон
Google Pay товч АВТОМАТ гарах уу?** (хэрэглэгчийн төхөөрөмж дэмждэг үед)

- Хэрэв гарах бол: invoice `providers[]` массивт ямар утга зааж өгөх вэ?
  (`E_COMMERCE` дотор орох уу, эсвэл тусдаа `APPLE_PAY`/`GOOGLE_PAY` утга байна уу?)

## 2. Хэрэв hosted дээр гарахгүй бол — V2 API
`/api/v2/payment/process` (Apple Pay) ба `/api/v2/payment/process/google` (Google Pay)
V2 API-г ашиглах шаардлагатай юу?

- V2 API-д ямар credential хэрэгтэй вэ? (`x-merchant-key` — одоогийн Terminal ID/Secret Key-ээс
  өөр эрх авах шаардлагатай юу?)
- Apple Pay JS SDK / Google Pay button-ыг вэбсайтад суулгах ёстой юу?

## 3. Apple Pay домэйн баталгаажуулалт
Apple Pay идэвхжүүлэхэд домэйн баталгаажуулах (`apple-developer-merchantid-domain-association`)
файл шаардлагатай юу? Тийм бол:
- Файлыг та (Bonum) өгөх үү, эсвэл бид Apple Developer-ээс авах уу?
- Домэйн: `digitalger.mn` (frontend) / `api.digitalger.mn` (backend)

## 4. Одоогийн байдал
Бид одоо Карт (VISA/Mastercard/UnionPay/Amex) + WeChat Pay-г hosted checkout (E_COMMERCE +
WE_CHAT provider) -ээр нэвтрүүлж байна. Apple/Google Pay-г танай хариултын дагуу нэмнэ.

## DigitalGer webhook URL
`https://api.digitalger.mn/api/payments/bonum/callback`
