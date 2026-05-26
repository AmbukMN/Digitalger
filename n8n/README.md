# DigitalGer — n8n Enterprise Automation Layer

Isolated automation service beside DigitalGer.
**Main stack-тай docker network, volume, DB хуваалцахгүй.**

---

## Local хөгжүүлэлт

```bash
cd n8n
docker compose up -d
# http://localhost:5678 → Setup wizard → эхний хэрэглэгч бүртгэнэ
```

---

## Production Deploy (VPS)

```bash
cd /opt/DigitalGer/n8n
cp .env.example .env
nano .env
docker compose up -d
docker compose logs -f
```

### .env-д заавал тохируулах

| Variable | Авах арга |
| --- | --- |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `N8N_BASIC_AUTH_PASSWORD` | хүчтэй нууц үг |
| `POSTGRES_PASSWORD` | хүчтэй нууц үг |
| `TELEGRAM_BOT_TOKEN` | @BotFather → /newbot |
| `TELEGRAM_ADMIN_CHAT_ID` | @userinfobot-аас авна |
| `N8N_SMTP_USER/PASS` | AWS SES SMTP credential |

---

## Командууд

| Үйлдэл | Команд |
| --- | --- |
| Эхлүүлэх | `docker compose up -d` |
| Зогсоох | `docker compose down` |
| Дахин эхлүүлэх | `docker compose restart` |
| Log | `docker compose logs -f` |
| Статус | `docker compose ps` |
| Shell | `docker exec -it digitalger-n8n sh` |
| Image шинэчлэх | `docker compose pull && docker compose up -d` |

---

## Хавтасны бүтэц

```text
n8n/
├── docker-compose.yml          — n8n + dedicated PostgreSQL
├── .env.example                — production template
├── .env                        — жинхэнэ config (gitignored)
├── .gitignore
├── README.md
│
├── data/                       — n8n runtime (gitignored)
│
├── workflows/
│   ├── payment/
│   │   └── qpay-paid-telegram-alert.json
│   ├── monitoring/
│   └── reports/
│
├── credentials/                — credential snapshot (gitignored)
├── backups/                    — local backup (gitignored, 7 хадгална)
├── custom-nodes/               — custom node package-ууд
└── scripts/
    └── backup.sh               — daily backup + R2 upload
```

---

## Webhook Endpoint бүтэц

| Path | Эх үүсвэр | Зориулалт |
| --- | --- | --- |
| `/webhook/qpay-paid` | DigitalGer backend | QPay payment.paid event |
| `/webhook/order-created` | DigitalGer backend | Шинэ захиалга |
| `/webhook/user-registered` | DigitalGer backend | Шинэ хэрэглэгч |
| `/webhook/monitoring-ping` | Cron / UptimeRobot | System alive check |

### Architecture

```text
QPay → DigitalGer Backend (source of truth)
               ↓
        POST /api/payments/webhook  (business logic дуусна)
               ↓
        n8n webhook trigger (observer — зөвхөн мэдэгдэл)
               ↓
        Telegram Admin Alert
```

---

## QPay → Telegram Workflow

**Файл:** `workflows/payment/qpay-paid-telegram-alert.json`

n8n UI дотор import хийх:

1. Settings → Import from file
2. `qpay-paid-telegram-alert.json` сонгоно
3. Telegram credential тохируулна
4. Workflow идэвхжүүлнэ

**Telegram мэдэгдлийн загвар:**

```text
💳 Шинэ төлбөр амжилттай!

👤 Хэрэглэгч: Батбаяр
📦 Бүтээгдэхүүн: Figma Template Pack
💰 Дүн: 25,000₮
🆔 Захиалга: ord_abc123
✅ Төлөв: ТӨЛӨГДСӨН
🕐 Цаг: 2026.05.26 14:30
```

---

## Backup

### Автоматаар (VPS crontab)

```bash
# crontab -e
0 3 * * * /opt/DigitalGer/n8n/scripts/backup.sh >> /var/log/n8n-backup.log 2>&1
```

### Гараар

```bash
docker exec digitalger-n8n n8n export:workflow --all \
  --output=/home/node/backups/workflows-$(date +%Y%m%d).json
```

### Backup стратеги

- Өдөр бүр 03:00-д автомат export
- **7 local backup** хадгалж, хуучнийг устгана (SSD хэмнэнэ)
- Cloudflare R2 дээр **бүх archive** хадгалагдана (урт хугацааны)

---

## Nginx Config (bot.digitalger.mn)

```nginx
server {
    listen 80;
    server_name bot.digitalger.mn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name bot.digitalger.mn;

    ssl_certificate     /etc/letsencrypt/live/bot.digitalger.mn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.digitalger.mn/privkey.pem;

    client_max_body_size 64M;

    location / {
        proxy_pass         http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

```bash
certbot --nginx -d bot.digitalger.mn
nginx -t && nginx -s reload
```

---

## Аюулгүй байдал

- [ ] `N8N_ENCRYPTION_KEY` → `openssl rand -hex 32`
- [ ] `N8N_BASIC_AUTH_PASSWORD` тохируулсан
- [ ] `POSTGRES_PASSWORD` хүчтэй нууц үг
- [ ] `.env` gitignored — commit хийгдэхгүй
- [ ] Nginx HTTPS шаардана
- [ ] VPS firewall: 80/443 нээлттэй, 5678 дотоод
- [ ] Cron backup тохируулсан
- [ ] Telegram bot зөвхөн admin chat-д мэдэгдэл илгээнэ
