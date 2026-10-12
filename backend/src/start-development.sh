#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.development"

# ── Preflight checks ────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo "[!] cloudflared not found (https://github.com/cloudflare/cloudflared/releases)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]] || ! grep -q '^RECIPIENT_PUBKEY=.' "$ENV_FILE"; then
  echo "[!] Set RECIPIENT_PUBKEY (the wallet that receives USDC) in ${ENV_FILE}"
  exit 1
fi

# ── Free port 3000 ──────────────────────────────────────────
if lsof -ti:3000 &>/dev/null; then
  echo "[*] Freeing port 3000"
  lsof -ti:3000 | xargs kill -9
fi

# ── Start the cloudflared tunnel and capture its URL ────────
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url http://localhost:3000 >"$TUNNEL_LOG" 2>&1 &
CLOUDFLARED_PID=$!

echo "[*] Starting cloudflared (PID=$CLOUDFLARED_PID)..."

TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)
  if [[ -n "$TUNNEL_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "[!] Could not get the cloudflared URL. Log:"
  cat "$TUNNEL_LOG"
  kill "$CLOUDFLARED_PID" 2>/dev/null || true
  exit 1
fi

# Write BASE_URL to .env.development
grep -v '^BASE_URL=' "$ENV_FILE" >"${ENV_FILE}.tmp" || true
echo "BASE_URL=${TUNNEL_URL}" >>"${ENV_FILE}.tmp"
mv "${ENV_FILE}.tmp" "$ENV_FILE"
echo "[+] Wrote BASE_URL=${TUNNEL_URL} to ${ENV_FILE}"

# ── Start the backend ───────────────────────────────────────
echo "[*] Starting the backend"
cd "${SCRIPT_DIR}/.."
npm run dev
