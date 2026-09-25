#!/usr/bin/env bash
# Bootstrap local: republica @alexendros/protonsuite-agent tras unpublish.
# Uso (en la terminal donde hiciste export NPM_TOKEN=...):
#   ./scripts/bootstrap-npm-local.sh [version]
# Por defecto version=1.4.3 (1.4.0–1.4.2 pueden estar quemadas tras unpublish).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-1.4.3}"

if [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "Falta NPM_TOKEN en el entorno. export NPM_TOKEN=… y vuelve a ejecutar." >&2
  exit 1
fi

# No imprimir el token. Auth solo para registry.npmjs.org.
export npm_config_registry="https://registry.npmjs.org/"
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" >"$ROOT/.npmrc.bootstrap"
cleanup() { rm -f "$ROOT/.npmrc.bootstrap"; }
trap cleanup EXIT

echo "Versión a publicar: $VERSION"
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.version=process.argv[1];
fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');
" "$VERSION"

pnpm install --frozen-lockfile
pnpm build

npm publish --access public --userconfig "$ROOT/.npmrc.bootstrap"

echo "OK: @alexendros/protonsuite-agent@$VERSION publicado."
echo "Siguiente: Settings del paquete → Trusted Publisher → Soluciones-Alexendros / protonsuite-tools / release.yml"
echo "Luego: revoca el token en https://www.npmjs.com/settings/~/tokens"
