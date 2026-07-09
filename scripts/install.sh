#!/usr/bin/env bash
# Instalador interactivo de Proton Suite Agent.
# Guía la instalación de Bridge, captura credenciales, configura Pass opcionalmente,
# genera .env y verifica conectividad.
set -euo pipefail

# ────────────────────────────────────────────────────────────────────
# Colores
# ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

info()  { echo -e "${CYAN}→${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
err()   { echo -e "${RED}✗${NC} $1"; }
ask()   { echo -en "${YELLOW}?${NC} $1 "; }
title() { echo -e "\n${BOLD}$1${NC}"; }

# ────────────────────────────────────────────────────────────────────
# Detección del SO
# ────────────────────────────────────────────────────────────────────
title "Proton Suite Agent · Instalador"
echo ""

OS=""
if grep -qi "arch\|endeavour" /etc/os-release 2>/dev/null; then
  OS="arch"
elif grep -qi "debian\|ubuntu\|mint" /etc/os-release 2>/dev/null; then
  OS="debian"
elif [[ "$(uname -s)" == "Darwin" ]]; then
  OS="macos"
fi

info "SO detectado: ${OS:-desconocido}"

# ────────────────────────────────────────────────────────────────────
# 1. Bridge
# ────────────────────────────────────────────────────────────────────
title "1. Proton Mail Bridge"

echo ""
echo "Proton Suite Agent necesita Proton Mail Bridge para acceder a tu correo."
echo "Bridge expone IMAP en localhost:1143 y SMTP en localhost:1025."

case "$OS" in
  arch)
    echo ""
    info "En Arch/EndeavourOS, instala Bridge con:"
    echo "    ${BOLD}sudo pacman -S protonmail-bridge-core${NC}"
    ;;
  debian)
    echo ""
    info "En Debian/Ubuntu, descarga Bridge desde:"
    echo "    ${BOLD}https://proton.me/mail/bridge${NC}"
    ;;
  macos)
    echo ""
    info "En macOS, instala Bridge desde:"
    echo "    ${BOLD}https://proton.me/mail/bridge${NC}"
    ;;
  *)
    echo ""
    info "Instala Proton Mail Bridge desde: ${BOLD}https://proton.me/mail/bridge${NC}"
    ;;
esac

echo ""
read -rp "$(ask '¿Tienes Bridge corriendo? (s/N): ')" BRIDGE_RUNNING
if [[ ! "$BRIDGE_RUNNING" =~ ^[Ss]$ ]]; then
  echo ""
  info "Inicia Bridge manualmente y ejecuta:"
  echo "    ${BOLD}protonmail-bridge-core --cli${NC}"
  echo "    Dentro: ${BOLD}login${NC} → credenciales Proton → 2FA → ${BOLD}info${NC} → ${BOLD}exit${NC}"
  echo ""
  read -rp "$(ask 'Presiona Enter cuando hayas completado el login...')"
fi

echo ""
read -rp "$(ask 'Dirección de Proton Mail (PROTON_BRIDGE_USER): ')" BRIDGE_USER
read -rp "$(ask 'Dirección "From" para envíos (PROTON_MAIL_FROM, Enter = misma): ')" MAIL_FROM
MAIL_FROM=${MAIL_FROM:-$BRIDGE_USER}

# ────────────────────────────────────────────────────────────────────
# 2. Contraseña de Bridge — ¿Pass?
# ────────────────────────────────────────────────────────────────────
title "2. Contraseña de Bridge"

echo ""
echo " ¿Cómo quieres gestionar la contraseña de Bridge?"
echo "   1) Variable de entorno (.env) — simple, la contraseña vive en texto plano"
echo "   2) Proton Pass (pass-cli) — resolución JIT, sin texto plano en disco"
echo ""
read -rp "$(ask 'Opción (1/2, Enter = 1): ')" PASS_OPTION
PASS_OPTION=${PASS_OPTION:-1}

BRIDGE_PASS_PATH=""
if [[ "$PASS_OPTION" == "2" ]]; then
  if ! command -v pass &>/dev/null; then
    err "pass CLI no instalado. Instálalo con: apt install pass / pacman -S pass"
    err "Usando variable de entorno como fallback."
    PASS_OPTION=1
  else
    echo ""
    read -rsp "$(ask 'Contraseña de Bridge: ')" BRIDGE_PASS
    echo ""
    echo "$BRIDGE_PASS" | pass insert --multiline proton/bridge/password
    ok "Contraseña guardada en Pass: proton/bridge/password"
    BRIDGE_PASS_PATH="proton/bridge/password"
    PASS_ENABLED=true
  fi
fi

if [[ "$PASS_OPTION" == "1" ]]; then
  read -rsp "$(ask 'Contraseña de Bridge: ')" BRIDGE_PASS
  echo ""
fi

# ────────────────────────────────────────────────────────────────────
# 3. Productos adicionales
# ────────────────────────────────────────────────────────────────────
title "3. Productos adicionales"

echo ""
ask "¿Habilitar Proton Pass? (s/N): " ENABLE_PASS
PASS_ENABLED=${PASS_ENABLED:-false}
[[ "$ENABLE_PASS" =~ ^[Ss]$ ]] && PASS_ENABLED=true

ask "¿Habilitar Proton Calendar? (s/N): " ENABLE_CALENDAR
CALENDAR_ENABLED=false
[[ "$ENABLE_CALENDAR" =~ ^[Ss]$ ]] && CALENDAR_ENABLED=true

ask "¿Habilitar Proton Drive? (s/N): " ENABLE_DRIVE
DRIVE_ENABLED=false
[[ "$ENABLE_DRIVE" =~ ^[Ss]$ ]] && DRIVE_ENABLED=true

# ────────────────────────────────────────────────────────────────────
# 4. Transporte
# ────────────────────────────────────────────────────────────────────
title "4. Transporte MCP"

echo ""
echo " El agente puede correr en dos modos:"
echo "   1) stdio — para clientes MCP locales (Claude Desktop, OpenCode)"
echo "   2) HTTP — para despliegues remotos con autenticación Bearer"
echo ""
read -rp "$(ask 'Modo (1/2, Enter = 1): ')" TRANSPORT_OPTION
TRANSPORT_OPTION=${TRANSPORT_OPTION:-1}

TRANSPORT="stdio"
AUTH_TOKEN=""
ALLOWED_ORIGINS=""

if [[ "$TRANSPORT_OPTION" == "2" ]]; then
  TRANSPORT="http"
  AUTH_TOKEN=$(openssl rand -hex 32)
  info "Token Bearer generado: ${BOLD}${AUTH_TOKEN}${NC}"
  read -rp "$(ask 'Allowed Origins (CSV, Enter = vacío): ')" ALLOWED_ORIGINS
fi

# ────────────────────────────────────────────────────────────────────
# 5. Almacenar configuración
# ────────────────────────────────────────────────────────────────────
title "5. Guardando configuración"

ENV_FILE=".env"

cat > "$ENV_FILE" <<EOF
# Proton Suite Agent · generado por install.sh
PROTON_BRIDGE_USER=$BRIDGE_USER
PROTON_BRIDGE_PASS=${BRIDGE_PASS:-}
PROTON_MAIL_FROM=$MAIL_FROM
PROTON_BRIDGE_HOST=127.0.0.1
PROTON_BRIDGE_IMAP_PORT=1143
PROTON_BRIDGE_SMTP_PORT=1025
PROTON_BRIDGE_TLS_INSECURE=true
EOF

if [[ -n "$BRIDGE_PASS_PATH" ]]; then
  echo "PROTON_BRIDGE_PASS_PATH=$BRIDGE_PASS_PATH" >> "$ENV_FILE"
fi

cat >> "$ENV_FILE" <<EOF
PROTON_PASS_ENABLED=$PASS_ENABLED
PROTON_PASS_STORE_DIR=~/.password-store
PROTON_CALENDAR_ENABLED=$CALENDAR_ENABLED
PROTON_DRIVE_ENABLED=$DRIVE_ENABLED
MCP_TRANSPORT=$TRANSPORT
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=8787
MCP_AUTH_TOKEN=$AUTH_TOKEN
MCP_ALLOWED_ORIGINS=$ALLOWED_ORIGINS
LOG_LEVEL=info
AGENT_DRY_RUN=true
EOF

ok "Configuración guardada en ${BOLD}$ENV_FILE${NC}"

# ────────────────────────────────────────────────────────────────────
# 6. Verificar conectividad
# ────────────────────────────────────────────────────────────────────
title "6. Verificando conectividad"

echo ""
info "Ejecutando prueba de conectividad con Bridge..."
if npx -y @alexendros/protonsuite-agent setup 2>&1 | tail -5; then
  ok "¡Conectividad verificada! Bridge responde correctamente."
else
  warn "La verificación falló. Revisa que Bridge esté corriendo y las credenciales sean correctas."
  warn "Puedes reintentar con: npx -y @alexendros/protonsuite-agent setup"
fi

# ────────────────────────────────────────────────────────────────────
# 7. Configuración MCP para el cliente
# ────────────────────────────────────────────────────────────────────
title "7. Configuración para tu cliente MCP"

if [[ "$TRANSPORT" == "stdio" ]]; then
  echo ""
  echo "Copia este bloque en la sección 'mcpServers' de tu cliente MCP:"
  echo ""
  echo -e "${BOLD}{${NC}"
  echo "  \"mcpServers\": {"
  echo "    \"protonsuite\": {"
  echo "      \"command\": \"npx\","
  echo "      \"args\": [\"-y\", \"@alexendros/protonsuite-agent\", \"protonsuite-mcp\"],"
  echo "      \"env\": {"
  echo "        \"PROTON_BRIDGE_USER\": \"$BRIDGE_USER\","
  if [[ -n "$BRIDGE_PASS_PATH" ]]; then
    echo "        \"PROTON_BRIDGE_PASS_PATH\": \"$BRIDGE_PASS_PATH\","
    echo "        \"PROTON_PASS_ENABLED\": \"true\","
    echo "        \"PROTON_PASS_STORE_DIR\": \"~/.password-store\""
  else
    echo "        \"PROTON_BRIDGE_PASS\": \"<tu-contraseña-de-bridge>\","
  fi
  echo "        \"PROTON_MAIL_FROM\": \"$MAIL_FROM\""
  echo "      }"
  echo "    }"
  echo "  }"
  echo "}"
else
  echo ""
  echo "Registra el servidor como Remote MCP Server en tu cliente:"
  echo ""
  echo -e "  URL:      ${BOLD}http://<tu-host>:8787/mcp${NC}"
  echo -e "  Auth:     ${BOLD}Bearer $AUTH_TOKEN${NC}"
  echo -e "  Headers:  ${BOLD}Origin: <tu-origen>${NC}"
fi

echo ""
echo -e "${GREEN}=== Instalación completada ===${NC}"
echo ""
echo "Comandos útiles:"
echo "  npx -y @alexendros/protonsuite-agent setup          — verificar conectividad"
echo "  npx -y @alexendros/protonsuite-agent pass-audit     — auditar vault de Pass"
echo "  npx -y @alexendros/protonsuite-agent suite-status   — estado de la suite"
echo ""
echo "Documentación: https://github.com/Iniciativas-Alexendros/agent-protonmail"
