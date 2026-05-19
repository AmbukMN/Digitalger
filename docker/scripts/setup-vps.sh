#!/bin/bash
# DigitalGer — VPS Initial Setup Script
# Run once on a fresh Hetzner Ubuntu 24.04 VPS as root
# Usage: curl -sSL https://raw.githubusercontent.com/AmbukMN/Digitalger/main/docker/scripts/setup-vps.sh | bash

set -euo pipefail

echo "======================================================"
echo " DigitalGer VPS Setup"
echo " $(date)"
echo "======================================================"

# ── 1. System update ─────────────────────────────────────────────────────────
echo "[1/8] System update..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install utilities ──────────────────────────────────────────────────────
echo "[2/8] Installing utilities..."
apt-get install -y -qq \
  git \
  curl \
  wget \
  vim \
  htop \
  ufw \
  certbot \
  fail2ban \
  unzip \
  jq

# ── 3. Install Docker ─────────────────────────────────────────────────────────
echo "[3/8] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $USER
else
  echo "Docker already installed: $(docker --version)"
fi

# ── 4. UFW Firewall ───────────────────────────────────────────────────────────
echo "[4/8] Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
# Block database ports (internal Docker network only)
ufw deny 5432/tcp   comment 'Block PostgreSQL public'
ufw deny 6379/tcp   comment 'Block Redis public'
ufw --force enable
echo "UFW status:"
ufw status verbose

# ── 5. Fail2ban ───────────────────────────────────────────────────────────────
echo "[5/8] Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# ── 6. Clone repository ───────────────────────────────────────────────────────
echo "[6/8] Cloning repository..."
mkdir -p /opt/DigitalGer
if [ -d "/opt/DigitalGer/.git" ]; then
  echo "Repo already exists, pulling latest..."
  cd /opt/DigitalGer && git pull
else
  git clone https://github.com/AmbukMN/Digitalger.git /opt/DigitalGer
fi

cd /opt/DigitalGer
mkdir -p backups logs

# ── 7. Environment file ───────────────────────────────────────────────────────
echo "[7/8] Creating environment template..."
if [ ! -f "/opt/DigitalGer/.env.production" ]; then
  cp /opt/DigitalGer/.env.production.example /opt/DigitalGer/.env.production
  chmod 600 /opt/DigitalGer/.env.production
  echo ""
  echo "⚠️  IMPORTANT: Edit /opt/DigitalGer/.env.production and fill in real secrets!"
  echo "   nano /opt/DigitalGer/.env.production"
else
  echo ".env.production already exists — skipping"
fi

# ── 8. Script permissions ─────────────────────────────────────────────────────
echo "[8/8] Setting script permissions..."
chmod +x /opt/DigitalGer/docker/scripts/*.sh

echo ""
echo "======================================================"
echo " VPS Setup Complete!"
echo "======================================================"
echo ""
echo "Next steps:"
echo "  1. Edit secrets:  nano /opt/DigitalGer/.env.production"
echo "  2. Setup SSL:     certbot certonly --standalone -d digitalger.mn -d www.digitalger.mn -d admin.digitalger.mn -d api.digitalger.mn"
echo "  3. Deploy:        cd /opt/DigitalGer && docker compose -f docker/docker-compose.prod.yml up -d --build"
echo ""
