#!/usr/bin/env bash
# Diagnóstico IMAP contra Proton Mail Bridge real.
# Carga .env, ejecuta el goal check-imap con LOG_LEVEL=debug y muestra
# la conversación IMAP completa sin imprimir nunca el password.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${PROTON_BRIDGE_USER:-}" || -z "${PROTON_BRIDGE_PASS:-}" ]]; then
  echo "[diagnose] PROTON_BRIDGE_USER y PROTON_BRIDGE_PASS deben estar definidos (en .env o en el entorno)." >&2
  exit 1
fi

if [[ ! -f dist/agent-cli.js ]]; then
  echo "[diagnose] dist/agent-cli.js missing — run: npm run build" >&2
  exit 1
fi

echo "[diagnose] Conectando a ${PROTON_BRIDGE_HOST:-127.0.0.1}:${PROTON_BRIDGE_IMAP_PORT:-1143} como ${PROTON_BRIDGE_USER}"
LOG_LEVEL=debug node dist/agent-cli.js check-imap
