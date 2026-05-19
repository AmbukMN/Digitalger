# DigitalGer — Орчны хувьсагчид (Environment Variables)

## Стратеги

### Локал хөгжүүлэлт
Сервис тус бүрийн `.env.example`-г хуулж ашиглана:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
```

### Production
**НЭГ** централ файл: `/opt/DigitalGer/.env.production`

```bash
# VPS дээр үүсгэх
cp .env.production.example /opt/DigitalGer/.env.production
nano /opt/DigitalGer/.env.production
chmod 600 /opt/DigitalGer/.env.production
```

Бүх Docker сервис энэ нэг файлаас уншина:
```yaml
env_file:
  - /opt/DigitalGer/.env.production
```

---

## Бүрэн хувьсагчдын жагсаалт

### Server
| Хувьсагч | Тайлбар | Жишээ |
|----------|---------|-------|
| `NODE_ENV` | Орчин | `production` |
| `PORT` | Backend port | `4000` |

### Database
| Хувьсагч | Тайлбар | Жишээ |
|----------|---------|-------|
| `POSTGRES_USER` | DB хэрэглэгч | `digitalger` |
| `POSTGRES_PASSWORD` | DB нууц үг | _(generate)_ |
| `POSTGRES_DB` | DB нэр | `digitalger` |
| `DATABASE_URL` | Prisma connection | `postgresql://...` |

> Production Docker: `@postgres:5432` (service name)
> Local Docker: `@localhost:5433` (mapped port)

### Redis
| Хувьсагч | Тайлбар | Жишээ |
|----------|---------|-------|
| `REDIS_URL` | Redis connection | `redis://redis:6379` |

### JWT
| Хувьсагч | Тайлбар | Жишээ |
|----------|---------|-------|
| `JWT_SECRET` | Access token secret | _(generate 64 hex)_ |
| `JWT_REFRESH_SECRET` | Refresh token secret | _(generate 64 hex)_ |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |

```bash
# Secret generate хийх
openssl rand -hex 64
```

### URLs
| Хувьсагч | Тайлбар | Production |
|----------|---------|-----------|
| `FRONTEND_URL` | Frontend URL | `https://digitalger.mn` |
| `ADMIN_URL` | Admin URL | `https://admin.digitalger.mn` |
| `API_URL` | Backend API URL | `https://api.digitalger.mn` |
| `CORS_ORIGIN` | Allowed origins (comma) | `https://digitalger.mn,...` |

### Next.js
| Хувьсагч | App | Тайлбар |
|----------|-----|---------|
| `NEXT_PUBLIC_SITE_URL` | Frontend | Нийтийн URL |
| `NEXT_PUBLIC_API_URL` | Frontend+Admin | Backend API URL |
| `NEXTAUTH_URL` | Frontend | `https://digitalger.mn` |
| `NEXTAUTH_SECRET` | Frontend+Admin | NextAuth secret |

> Admin нь NEXTAUTH_URL-г `https://admin.digitalger.mn` болгон docker-compose.prod.yml-д override хийнэ.

### Cloudflare R2
| Хувьсагч | Тайлбар |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 API key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API secret |
| `R2_BUCKET_NAME` | Bucket нэр: `digitalger-assets` |
| `R2_ENDPOINT` | `https://<id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | `https://assets.digitalger.mn` |

### QPay
| Хувьсагч | Тайлбар |
|----------|---------|
| `QPAY_USERNAME` | QPay merchant username |
| `QPAY_PASSWORD` | QPay merchant password |
| `QPAY_INVOICE_CODE` | Invoice code |
| `QPAY_CALLBACK_URL` | `https://api.digitalger.mn/api/payments/webhook` |
| `QPAY_WEBHOOK_SECRET` | Webhook signature secret |

### OAuth (нэмэлт)
| Хувьсагч | Тайлбар |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |
| `FACEBOOK_CLIENT_ID` | Facebook App ID |
| `FACEBOOK_CLIENT_SECRET` | Facebook App Secret |

### AI (нэмэлт)
| Хувьсагч | Тайлбар |
|----------|---------|
| `ANTHROPIC_API_KEY` | Admin AI content generation |

---

## Аюулгүй байдал

- `.env`, `.env.local`, `.env.production` файлуудыг **git-д хэзээ ч commit хийхгүй**
- `.env.example` болон `.env.production.example` зөвхөн placeholder утгатай — commit хийж болно
- Production файлд `chmod 600` тохируулах
- JWT secret-уудыг `openssl rand -hex 64`-аар generate хийх
