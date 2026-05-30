# Publish to MCP Registry · operator playbook

> Aplica tras mergear PR `rename/protonmail-mcp` (rename completo del paquete + bump `0.2.0`). Para republicaciones futuras de v0.2.x+, sustituir version en los ejemplos.

## Por qué

El repo upstream `modelcontextprotocol/servers` retiró su lista community en favor del [MCP Server Registry](https://registry.modelcontextprotocol.io/) (preview · API v0.1 frozen). La distribución oficial pasa por publicar metadata via `mcp-publisher` CLI tras tener el paquete npm.

## Pre-requisitos

- ✅ PR `feat/mcp-registry-publish-v2` mergeado a `main`
- ✅ Acceso a npm con bypass 2FA token (ya validado en publicación 0.1.0)
- ✅ Cuenta GitHub asociada (`Alexendros`) — necesaria para auth en registry
- ✅ macOS/Linux con `curl`, `tar`, `node` >= 20

## §1 · Republicar npm con `mcpName`

```bash
cd ~/Repositorios/protonmail-mcp
git checkout main && git pull
node -v   # >= 20
npm install
npm run build
npm test          # vitest run · debe pasar verde
bash scripts/smoke.sh   # smoke OK
```

Verifica `package.json` tiene los 2 campos críticos:

```bash
node -e "const p=require('./package.json'); console.log({name:p.name, version:p.version, mcpName:p.mcpName})"
# Esperado:
# { name: '@alexendros/protonmail-mcp', version: '0.2.0', mcpName: 'io.github.Alexendros/protonmail-mcp' }
```

Publish:

```bash
npm publish --access public
# Si pide OTP: usa el token con bypass 2FA (NPM_TOKEN env) o aprueba en authenticator app
```

Verifica:

```bash
npm view @alexendros/protonmail-mcp version mcpName
# Esperado:
# 0.2.0
# io.github.Alexendros/protonmail-mcp
```

## §2 · Instalar `mcp-publisher` CLI

```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/

mcp-publisher --help
# Esperado: muestra subcommands init/login/logout/publish
```

(Alternativa Homebrew: `brew install mcp-publisher` si tienes brew en Linux/macOS.)

## §3 · Verificar `server.json` local

`server.json` ya está commiteado en repo. Verifica que su `name` coincide con `mcpName` en `package.json`:

```bash
cd ~/Repositorios/protonmail-mcp
node -e "const s=require('./server.json'),p=require('./package.json'); console.log('match:', s.name===p.mcpName, '| name:', s.name, '| version:', s.version, '| pkg.version:', p.version)"
# Esperado:
# match: true | name: io.github.Alexendros/protonmail-mcp | version: 0.2.0 | pkg.version: 0.2.0
```

Las versiones de `server.json` raíz y `server.json.packages[0].version` deben coincidir con la version recién publicada en npm (`0.2.0`).

## §4 · Login GitHub-based

```bash
mcp-publisher login github
# Output:
# Logging in with github...
# To authenticate, please:
# 1. Go to: https://github.com/login/device
# 2. Enter code: ABCD-1234
# 3. Authorize this application
# Waiting for authorization...
```

Visita el link en el browser logueado como `Alexendros`, introduce el code, autoriza la app `mcp-publisher`. Vuelve al terminal y verás:

```
Successfully authenticated!
✓ Successfully logged in
```

Razón GitHub auth: nuestro `mcpName` empieza con `io.github.alexendros/` → el registry verifica que el GitHub user que se autentica coincide con el namespace.

## §5 · Publish

```bash
cd ~/Repositorios/protonmail-mcp
mcp-publisher publish
# Output esperado:
# Publishing to https://registry.modelcontextprotocol.io...
# ✓ Successfully published
# ✓ Server io.github.Alexendros/protonmail-mcp version 0.2.0
```

## §6 · Verificación post-publish

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Alexendros/protonmail-mcp" | jq .
# Debes ver tu server en .servers[]
# Verifica .servers[0].packages[0].identifier == "@alexendros/protonmail-mcp"
# Verifica .servers[0].version == "0.2.0"
```

También puedes navegar a `https://registry.modelcontextprotocol.io/` y buscar manualmente.

## §7 · Anuncio en cuadernos + memoria

Tras éxito, append a:
1. `~/.claude/cuadernos/infra__ProtonCuracion_Higiene-integral-Proton-mail-pass-pgp-historico/bitacora.md` (entrada `## 2026-05-XX HH:MM · v0.2.0 publicada en MCP Registry`)
2. `~/.claude/cuadernos/alexendros-code-core/integraciones-vivas.md` (sección "Servidores MCP publicados")
3. `~/.claude/projects/-var-home-soyalexendros/memory/project_proton_mail_mcp.md` (actualizar estado)

## Troubleshooting

### `Registry validation failed for package`
- Verifica que `mcpName` en `package.json` coincide con `name` en `server.json`.
- Si publicaste npm SIN `mcpName`, republica con bump (`0.1.2`) tras añadirlo.

### `Invalid or expired Registry JWT token`
- `mcp-publisher login github` de nuevo.

### `You do not have permission to publish this server`
- Tu auth GitHub no es `Alexendros`. Verifica con `gh api user --jq .login`.
- Si eres `Alexendros` pero el namespace registry esperaba `alexendros` lowercase: el caso es sensible. El docs usa lowercase (`io.github.my-username/`); GitHub también acepta lowercase como canónico en URLs. Si rechaza, prueba con `io.github.Alexendros/...` (case sensible exacto del username).

### `Server already exists with different ownership`
- Alguien ya publicó con ese nombre antes. Cambia el segmento del namespace o contacta upstream.

## Tiempo estimado total: 30-40 min

(20 min setup CLI + 10 min publish + 10 min verificación)

## Próximo paso (post-publish verde)

Crear release `v0.2.0` en GitHub:

```bash
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --notes-from-file <(awk '/## \[0.2.0\]/,/## \[0.1.0\]/' CHANGELOG.md | head -n -1)
```
