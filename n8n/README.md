# DigitalGer — n8n Automation Layer

Isolated enterprise automation service.
**Main DigitalGer stack-тай docker network, volume хуваалцахгүй.**

---

## Local хөгжүүлэлт

```bash
cd n8n
docker compose up -d

# http://localhost:5678 нээнэ
# Setup wizard → эхний хэрэглэгч бүртгэнэ
```

Local-д `.env` файл шаардлагагүй — `docker-compose.yml` default утгуудаар ажиллана.

---

## Production Deploy (VPS)

```bash
# 1. VPS дээр pull хийнэ
cd /opt/DigitalGer/n8n

# 2. .env тохируулна
cp .env.example .env
nano .env

# 3. Заавал тохируулах утгууд:
#    N8N_ENCRYPTION_KEY  → openssl rand -hex 32
#    N8N_BASIC_AUTH_PASSWORD → хүчтэй нууц үг
#    N8N_SMTP_USER / N8N_SMTP_PASS → AWS SES SMTP credential

# 4. Ажиллуулна
docker compose up -d

# 5. Log шалгана
docker compose logs -f
```

---

## Командууд

| Үйлдэл | Команд |
|--------|--------|
| Эхлүүлэх | `docker compose up -d` |
| Зогсоох | `docker compose down` |
| Дахин эхлүүлэх | `docker compose restart` |
| Log (дагах) | `docker compose logs -f` |
| Статус | `docker compose ps` |
| Image шинэчлэх | `docker compose pull && docker compose up -d` |
| Shell | `docker exec -it digitalger-n8n sh` |

---

## Хавтасны зориулалт

```
n8n/
├── docker-compose.yml     — container тодорхойлолт (local + production)
├── .env.example           — бүх variable жишээтэй
├── .env                   — жинхэнэ config (gitignored)
├── .gitignore
├── README.md
│
├── data/                  — n8n runtime (gitignored)
│   └── database.sqlite    — workflow, execution, credential өгөгдөл
│
├── workflows/             — workflow JSON export
├── credentials/           — credential snapshot (gitignored)
├── backups/               — backup архив (gitignored)
└── custom-nodes/          — custom n8n node package-ууд
```

---

## Backup

### Гараар backup авах
```bash
# Workflow-уудыг export хийнэ
docker exec digitalger-n8n n8n export:workflow --all \
  --output=/home/node/backups/workflows-$(date +%Y%m%d).json

# Credential-уудыг export хийнэ
docker exec digitalger-n8n n8n export:credentials --all \
  --output=/home/node/backups/credentials-$(date +%Y%m%d).json
```

### Автоматаар (VPS crontab)
```bash
# crontab -e
0 3 * * * cd /opt/DigitalGer/n8n && \
  docker exec digitalger-n8n n8n export:workflow --all --output=/home/node/backups/workflows-$(date +\%Y\%m\%d).json && \
  docker exec digitalger-n8n n8n export:credentials --all --output=/home/node/backups/credentials-$(date +\%Y\%m\%d).json
```

### Restore хийх
```bash
docker exec -i digitalger-n8n n8n import:workflow \
  --input=/home/node/backups/workflows-YYYYMMDD.json
docker exec -i digitalger-n8n n8n import:credentials \
  --input=/home/node/backups/credentials-YYYYMMDD.json
```

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
        proxy_send_timeout 300s;
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
- [ ] `.env` файл gitignored, commit хийгдэхгүй
- [ ] Nginx HTTPS шаардана
- [ ] VPS firewall: 80/443 нээлттэй, 5678 зөвхөн дотоод
- [ ] Cron backup тохируулсан

---

## Ирээдүйн интеграц

| Интеграц | Зориулалт |
|----------|-----------|
| DigitalGer API | Захиалга, хэрэглэгч trigger |
| Facebook Messenger | Харилцагчийн дэмжлэг автоматжуулалт |
| Instagram | DM, сэтгэгдэл хариулах |
| Telegram | Admin alert, мэдэгдэл |
| AWS SES events | Bounce/complaint шийдвэрлэлт |
| PostgreSQL | Аналитик, тайлан |
| pgvector | AI agent санах ой |
| Anthropic Claude | AI-powered workflow алхам |
