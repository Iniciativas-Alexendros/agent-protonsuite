#!/usr/bin/env bash
# Levanta GreenMail (IMAP/SMTP de prueba) en Docker, corre la suite E2E contra
# él con los clientes reales, y limpia al terminar. Para uso LOCAL — en CI el
# GreenMail va como service container y se usa directamente `npm run test:e2e`.
#
#   bash scripts/e2e-greenmail.sh
#
# Requiere Docker. No toca tu Proton Mail real: GreenMail es un servidor aislado.
set -euo pipefail

IMAGE="greenmail/standalone:2.1.0"
NAME="protonmail-agent-e2e-greenmail"
IMAP_PORT="${GREENMAIL_IMAP_PORT:-3143}"
SMTP_PORT="${GREENMAIL_SMTP_PORT:-3025}"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
echo "[e2e] arrancando GreenMail ($IMAGE) en :$IMAP_PORT (imap) / :$SMTP_PORT (smtp)…"
docker run -d --name "$NAME" \
  -p "${IMAP_PORT}:3143" -p "${SMTP_PORT}:3025" \
  -e GREENMAIL_OPTS='-Dgreenmail.setup.test.all -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.auth.disabled' \
  "$IMAGE" >/dev/null

# Espera a que GreenMail anuncie que arrancó los servicios.
for _ in $(seq 1 30); do
  if docker logs "$NAME" 2>&1 | grep -q "Started imap"; then break; fi
  sleep 1
done
sleep 2

echo "[e2e] corriendo suite…"
PATH=/usr/bin:$PATH GREENMAIL_HOST=127.0.0.1 GREENMAIL_IMAP_PORT="$IMAP_PORT" GREENMAIL_SMTP_PORT="$SMTP_PORT" \
  npm run test:e2e
