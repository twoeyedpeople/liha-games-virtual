#!/bin/bash

# ============================================
# LiHa Games - A2 Hosting Deploy Script
# ============================================
#
# SETUP: Fill in your A2 Hosting details below
#
# First-time setup:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# ============================================

set -e

# === CONFIGURATION (edit these if needed) ===
A2_USER="vanessas"
A2_HOST="vanessasaporito.com"
APP_PATH="liha"          # Upload target in home directory: ~/liha
NODE_VERSION="20"        # Major version only

# === COLORS FOR OUTPUT ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     LiHa Games Deploy Script       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
echo ""

# Step 1: Basic local validation
echo -e "${YELLOW}🔎 Running local checks...${NC}"
node --check server.js
node --check public/app.js
echo -e "${GREEN}✓ Local checks passed${NC}"
echo ""

# Step 2: Sync files to A2 Hosting
echo -e "${YELLOW}🚀 Uploading to A2 Hosting...${NC}"

rsync -avz --progress --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude 'logs' \
    --exclude 'tmp' \
    --exclude 'certs' \
    --exclude 'data/game-analytics.json' \
    ./ ${A2_USER}@${A2_HOST}:~/${APP_PATH}/

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Step 3: Install dependencies and restart app on server
echo -e "${YELLOW}🔄 Installing dependencies & restarting app...${NC}"

ssh ${A2_USER}@${A2_HOST} << EOF
    set -e
    cd ~/${APP_PATH}

    # Ensure app writable runtime directories exist
    mkdir -p data logs tmp

    # Source Node.js environment (A2/cPanel Node app)
    source ~/nodevenv/${APP_PATH}/${NODE_VERSION}/bin/activate 2>/dev/null || true

    # Install production dependencies
    npm install --production --silent

    # Passenger restart trigger (A2 standard)
    touch tmp/restart.txt

    echo "App restarted successfully!"
EOF

echo ""
echo -e "${GREEN}╔════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Deployment Complete!          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════╝${NC}"
echo ""
echo -e "   App path: ${BLUE}~/${APP_PATH}${NC}"
echo -e "   Site URL: ${BLUE}https://${A2_HOST}${NC}"
echo ""
