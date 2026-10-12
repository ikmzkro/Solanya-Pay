#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.development"

# ── 事前チェック ────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo "[!] cloudflared が見つかりません（macOS: brew install cloudflared）"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]] || ! grep -q '^RECIPIENT_PUBKEY=.' "$ENV_FILE"; then
  echo "[!] ${ENV_FILE} に RECIPIENT_PUBKEY（受取ウォレットのアドレス）を設定してください"
  exit 1
fi

# ── ポート 3000 を解放 ───────────────────────────────────────
if lsof -ti:3000 &>/dev/null; then
  echo "[*] ポート 3000 を解放します"
  lsof -ti:3000 | xargs kill -9
fi

# ── cloudflared トンネル起動（URL を捕捉） ──────────────────
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url http://localhost:3000 >"$TUNNEL_LOG" 2>&1 &
CLOUDFLARED_PID=$!

echo "[*] cloudflared 起動中 (PID=$CLOUDFLARED_PID)..."

TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)
  if [[ -n "$TUNNEL_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "[!] cloudflared の URL を取得できませんでした。ログ:"
  cat "$TUNNEL_LOG"
  kill "$CLOUDFLARED_PID" 2>/dev/null || true
  exit 1
fi

# BASE_URL を .env.development に書き込む
grep -v '^BASE_URL=' "$ENV_FILE" >"${ENV_FILE}.tmp" || true
echo "BASE_URL=${TUNNEL_URL}" >>"${ENV_FILE}.tmp"
mv "${ENV_FILE}.tmp" "$ENV_FILE"
echo "[+] BASE_URL=${TUNNEL_URL} を ${ENV_FILE} に書き込みました"

# ── バックエンド起動 ────────────────────────────────────────
echo "[*] バックエンドを起動します"
cd "${SCRIPT_DIR}/.."
npm run dev
