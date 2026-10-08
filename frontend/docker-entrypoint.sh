#!/bin/sh
# ── Runtime config injection ──────────────────────────────────────────────────
# Writes /usr/share/nginx/html/config.js from env vars so the SPA can discover
# the backend and the SSO provider without a rebuild.
#
#   API_URL        default /api (nginx proxies /api → backend on same origin)
#   OIDC_AUTHORITY  e.g. https://id.example.org/application/o/ouchtracker/
#   OIDC_CLIENT_ID  e.g. ouchtracker   (empty ⇒ only local email/password login)

API_URL="${API_URL:-/api}"
OIDC_AUTHORITY="${OIDC_AUTHORITY:-}"
OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  apiUrl: '${API_URL}',
  oidcAuthority: '${OIDC_AUTHORITY}',
  oidcClientId: '${OIDC_CLIENT_ID}',
};
EOF

echo "[entrypoint] config.js written — apiUrl=${API_URL} oidc=${OIDC_CLIENT_ID:-(off)}"

exec nginx -g "daemon off;"
