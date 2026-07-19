#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# update-coverage-badge.sh
#
# Actualiza el badge shields.io de cobertura en README.md con el % real.
#
# Uso:
#   bash scripts/update-coverage-badge.sh              # corre vitest + actualiza
#   bash scripts/update-coverage-badge.sh --skip-run    # solo procesa JSON existente
#   bash scripts/update-coverage-badge.sh --check       # verifica sin modificar
# ---------------------------------------------------------------------------
set -euo pipefail

COVERAGE_FILE="coverage/coverage-summary.json"
README="README.md"
mode="${1#--}"  # normalize: --check → check, --skip-run → skip-run
MODE="${mode:-update}"

# ── 1. Ejecutar vitest solo si es necesario ──────────────────────────────
if [[ "$MODE" == "update" ]]; then
  echo "→ Running vitest --coverage …"
  npx vitest run --coverage --reporter=default 2>/dev/null
fi

# ── 2. Leer coverage del JSON ────────────────────────────────────────────
if [[ ! -f "$COVERAGE_FILE" ]]; then
  echo "❌ $COVERAGE_FILE not found. Run 'vitest run --coverage' first."
  exit 1
fi

PCT=$(node -e "
const fs = require('fs');
const r = JSON.parse(fs.readFileSync('${COVERAGE_FILE}', 'utf-8'));
console.log(r.total.statements.pct.toFixed(2));
")

echo "→ Coverage: $PCT% statements"

# ── 3. Elegir color según rango ──────────────────────────────────────────
# Color por rango — usa comparación entera (sin bc)
PCT_INT="${PCT%.*}"
if (( PCT_INT >= 90 )); then
  COLOR="brightgreen"
elif (( PCT_INT >= 80 )); then
  COLOR="yellowgreen"
elif (( PCT_INT >= 70 )); then
  COLOR="yellow"
else
  COLOR="red"
fi

NEW_BADGE="[![Coverage](https://img.shields.io/badge/coverage-${PCT}%25-${COLOR}?logo=vitest&logoColor=white)](https://github.com/Iniciativas-Alexendros/agent-protonsuite/actions/workflows/quality.yml)"

# ── 4. Modo check ────────────────────────────────────────────────────────
CURRENT_PCT=$(grep -oP '(?<=coverage-)[\d.]+(?=%25-)' "$README" | head -1 || echo "")
if [[ "$MODE" == "check" ]]; then
  if [[ "$CURRENT_PCT" != "$PCT" ]]; then
    echo "❌ Badge out of date: README has ${CURRENT_PCT:-???}%, actual is $PCT%"
    exit 1
  fi
  echo "✅ Badge is up to date ($PCT%)"
  exit 0
fi

# ── 5. Reemplazar badge ──────────────────────────────────────────────────
# Buscar línea que contiene el badge y reemplazarla completamente.
# Usamos '|' como delimiter de sed para evitar colisiones con '/' de las URLs.
BADGE_MARKER='img.shields.io/badge/coverage-'
if grep -q "$BADGE_MARKER" "$README"; then
  sed -i "s|^.*${BADGE_MARKER}.*$|${NEW_BADGE}|" "$README"
  echo "✅ README.md badge updated to $PCT% ($COLOR)"
else
  echo "❌ No coverage badge found in $README"
  exit 1
fi

# ── 6. Actualizar texto en sección de calidad ────────────────────────────
QUALITY_TEXT_PATTERN='npm run coverage'
QUALITY_LINE=$(grep -n "$QUALITY_TEXT_PATTERN" "$README" | head -1 || true)
if [[ -n "$QUALITY_LINE" ]]; then
  LINE_NUM=$(echo "$QUALITY_LINE" | cut -d: -f1)
  sed -i "${LINE_NUM}s|[0-9.]\+% statements|${PCT}% statements|" "$README"
  echo "✅ Quality section coverage text updated"
fi
