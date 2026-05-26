# DigitalGer — n8n Automation Layer

Isolated enterprise automation service running alongside the main DigitalGer stack.
**Does not share Docker networks or volumes with the main application.**

---

## Quick Start

```bash
cd n8n

# 1. Configure environment
cp .env.example .env
# Edit .env — set N8N_ENCRYPTION_KEY, N8N_BASIC_AUTH_PASSWORD, SMTP credentials

# 2. Generate encryption key
openssl rand -hex 32

# 3. Start
docker compose up -d

# 4. Open editor
# https://bot.digitalger.mn  (production)
# http://localhost:5678       (local)
```

---

## Commands

| Action | Command |
|--------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Restart | `docker compose restart` |
| Logs (follow) | `docker compose logs -f` |
| Logs (n8n only) | `docker compose logs -f n8n` |
| Status | `docker compose ps` |
| Update image | `docker compose pull && docker compose up -d` |
| Shell access | `docker exec -it digitalger-n8n sh` |

---

## Directory Structure

```
n8n/
├── docker-compose.yml     — isolated service definition
├── .env.example           — all configurable variables with docs
├── .env                   — actual config (gitignored)
├── .gitignore
├── README.md
│
├── data/                  — n8n runtime data (gitignored)
│   ├── database.sqlite    — workflow definitions, execution history
│   ├── config             — n8n internal config
│   └── .n8n/             — credentials (encrypted)
│
├── workflows/             — exported workflow JSON backups
│   └── *.json            — export manually or via backup script
│
├── credentials/           — credential export snapshots (gitignored)
│   └── *.json            — encrypted, safe to store
│
├── backups/               — automated backup archives (gitignored)
│   └── YYYY-MM-DD.tar.gz
│
└── custom-nodes/          — custom n8n node packages
    └── node_modules/      — installed via npm inside this folder
```

---

## Backup Strategy

### Manual backup
```bash
# Export all workflows from n8n UI:
# Settings → Import/Export → Export all workflows

# Or via CLI inside container:
docker exec digitalger-n8n n8n export:workflow --all --output=/home/node/backups/workflows-$(date +%Y%m%d).json
docker exec digitalger-n8n n8n export:credentials --all --output=/home/node/backups/credentials-$(date +%Y%m%d).json
```

### Automated daily backup (add to VPS crontab)
```bash
# crontab -e
0 3 * * * cd /opt/DigitalGer/n8n && docker exec digitalger-n8n n8n export:workflow --all --output=/home/node/backups/workflows-$(date +\%Y\%m\%d).json && docker exec digitalger-n8n n8n export:credentials --all --output=/home/node/backups/credentials-$(date +\%Y\%m\%d).json
```

### Restore from backup
```bash
docker exec -i digitalger-n8n n8n import:workflow --input=/home/node/backups/workflows-YYYYMMDD.json
docker exec -i digitalger-n8n n8n import:credentials --input=/home/node/backups/credentials-YYYYMMDD.json
```

### Full data backup (includes SQLite DB)
```bash
tar -czf backups/n8n-full-$(date +%Y%m%d).tar.gz data/
```

---

## Architecture

```
Internet
    │
    ▼
Nginx / Caddy (reverse proxy)
    │  bot.digitalger.mn → localhost:5678
    ▼
digitalger-n8n (container)
    │
    ├── Webhooks  ← Facebook, Instagram, Telegram, QPay
    ├── Schedules ← Cron-based automations
    └── Triggers  ← DigitalGer API events
```

### Planned integrations

| Integration | Status | Purpose |
|-------------|--------|---------|
| DigitalGer API | Planned | Order events, user triggers |
| Facebook Messenger | Planned | Customer support automation |
| Instagram | Planned | DM automation, comment replies |
| Telegram | Planned | Admin alerts, notifications |
| AWS SES events | Planned | Bounce/complaint handling |
| PostgreSQL | Planned | Analytics queries, reporting |
| pgvector | Planned | AI agent memory, embeddings |
| Anthropic Claude | Planned | AI-powered workflow steps |

---

## Nginx Configuration (VPS)

Add to your nginx config at `/etc/nginx/sites-available/bot.digitalger.mn`:

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

Then:
```bash
certbot --nginx -d bot.digitalger.mn
nginx -t && nginx -s reload
```

---

## Upgrading n8n

```bash
docker compose pull
docker compose up -d
docker compose logs -f n8n
```

n8n runs automatic DB migrations on startup — no manual steps needed.

---

## Security Checklist

- [ ] `N8N_ENCRYPTION_KEY` set to a strong random value (`openssl rand -hex 32`)
- [ ] `N8N_BASIC_AUTH_PASSWORD` changed from default
- [ ] `.env` is gitignored and never committed
- [ ] Nginx enforces HTTPS
- [ ] VPS firewall allows only port 80/443 externally (5678 is internal only)
- [ ] Backup cron job configured
- [ ] Credentials exported and stored securely
