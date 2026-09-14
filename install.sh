#!/usr/bin/env bash
set -euo pipefail
INSTALL_PATH="${1:-$HOME/theta-workplace}"
command -v node >/dev/null 2>&1 || { echo "Node.js 18 veya daha yeni bir sürüm gerekli: https://nodejs.org"; exit 1; }
mkdir -p "$INSTALL_PATH/data"
cp -R public server.js package.json TAILSCALE.md EMBED.md "$INSTALL_PATH/"
printf 'theta-workplace kuruldu: %s\n' "$INSTALL_PATH"
printf 'Başlatmak için: cd "%s" && npm start\n' "$INSTALL_PATH"
printf 'Tailscale modu için: cd "%s" && npm run start:tailscale:linux\n' "$INSTALL_PATH"
