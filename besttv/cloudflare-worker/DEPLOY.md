# Видео CDN Worker — deploy заавар

## 1) Дараах 3 командыг ажиллуулна

```bash
cd C:/Users/ALIENWARE/Desktop/DigitalGer/besttv/cloudflare-worker

# (1) Cloudflare-д нэвтрэх — браузер нээгдэнэ, Allow дарна
npx wrangler login

# (2) Гарын үсгийн нууц түлхүүр — доорх утгыг ЯГ ХУУЛЖ буулгана
npx wrangler secret put VIDEO_SIGN_SECRET
# → асуухад буулгах утга:
# 7a4a79f961369ac294dd0d03e8195fd3b339c1f397739ea58adc854e75e7d04d

# (3) Deploy
npx wrangler deploy
```

## 2) Дууссаны дараа надад хэлнэ үү

Би VPS дээр `.env.production`-д дараахыг нэмж, backend-ийг дахин
асаагаад бүх зүйлийг тестлэнэ:

```
VIDEO_CDN_URL=https://cdn.besttv.us
VIDEO_SIGN_SECRET=7a4a79f961369ac294dd0d03e8195fd3b339c1f397739ea58adc854e75e7d04d
```

---

## Юу болох вэ

| Өмнө | Дараа |
|---|---|
| `cdn.besttv.us/movies/...` → **200 нээлттэй** ⚠️ | → **404** (гарын үсэггүй) ✅ |
| Segment кэшгүй (`DYNAMIC`) | 330+ хотод кэштэй (`HIT`) ✅ |
| Хол улсаас удаан | 2-5 дахин хурдан ✅ |

⚠️ Backend-д `VIDEO_CDN_URL` нэмэх хүртэл сайт **хуучнаараа** ажиллана —
Worker deploy хийсэн ч юу ч эвдрэхгүй.
