# Publicación a npm y GHCR

Abrir cuando: Configuras Trusted Publishing, diagnosticas un Release rojo o
cambias el email de la cuenta npm.
Aprobado: 24 de septiembre de 2026
Autoridad: Operativa
Estado: Aprobado
Propósito: Contrato de publicación (GitHub Release + GHCR + npm OIDC).

Este documento describe cómo se publica `@alexendros/protonsuite-agent`.
**No se usa `NPM_TOKEN` en CI.** npm usa [Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC). El paquete **existe** en el registry (`1.4.0`, 2026-09-24). `.releaserc.json`
mantiene `npmPublish: false` hasta que el Trusted Publisher esté configurado (si no,
`verifyConditions` rompe Release en cada push). El job `release` ya fuerza npm CLI ≥ 11.5.1.

## Trusted Publisher (checklist operador)

Si OIDC falla en Release, verifica en npmjs.com → paquete → Settings → Trusted Publisher:

1. **Provider:** GitHub Actions
2. **Organization or user:** `Iniciativas-Alexendros`
3. **Repository:** `agent-protonsuite`
4. **Workflow filename:** `release.yml`
5. **Environment:** vacío
6. **Allowed actions:** permitir `npm publish`

Primera publicación ya hecha (bootstrap manual a `1.4.0`). Tras configurar Trusted
Publisher, cambia `.releaserc.json` a `"npmPublish": true` en un PR de una línea.
Bumps futuros: push a `main` con `feat`/`fix` → semantic-release + OIDC.

## Cambio de email de la cuenta npm

El token de automatización **no** puede cambiar email (403 / política 2FA). Hay que
hacerlo en la UI con contraseña (+ OTP si aplica):

1. https://www.npmjs.com/settings/~/profile
2. Email → `operaciones@alexendros.dev`
3. Confirmar el enlace de verificación en el buzón.

## Cómo funciona

1. Cada push a `main` dispara `release.yml` → `semantic-release` analiza commits.
2. Si hay un `feat:`, `fix:` o `BREAKING CHANGE:` desde el último tag, se crea
   una nueva versión (GitHub Release + tag `vX.Y.Z`) y se publica a npm vía OIDC.
3. `semantic-release` actualiza `CHANGELOG.md` en el job; no hace push a `main`
   (`@semantic-release/git` omitido: rama protegida, GH006).
4. Si hay release nueva, el job `publish-ghcr` construye desde el tag `vX.Y.Z`.
5. PRs que tocan el workflow corren `semantic-release --dry-run` (sin publicar).
6. `workflow_dispatch` con `bootstrap-npm=true` publica la versión actual de
   `package.json` sin cortar tag (rescate).

## Requisitos duros (OIDC)

| Requisito | Valor en este repo |
| --- | --- |
| npm CLI | ≥ **11.5.1** (job `release` instala `npm@^11.5.1`) |
| Node | ≥ 22.14 (GHA `node-version: 22`) |
| Permiso Actions | `id-token: write` en el job `release` |
| Runner | GitHub-hosted |
| `repository.url` | Coincide con `Iniciativas-Alexendros/agent-protonsuite` |

## Verificar publicación

```bash
gh release view --repo Iniciativas-Alexendros/agent-protonsuite
npm view @alexendros/protonsuite-agent version
```

## Troubleshooting

| Problema | Solución |
| --- | --- |
| `EINVALIDNPMTOKEN` / `401 whoami` | Trusted Publisher mal configurado o npm &lt; 11.5.1. **No** añadir `NPM_TOKEN` a CI. |
| `404 OIDC token exchange` | Workflow filename / org / repo no coinciden con Trusted Publisher. |
| `ENEEDAUTH` en bootstrap | Igual que arriba; o package visibility. |
| Commit `chore:`/`docs:` no crea tag | Correcto: no hay bump. |
| Version en `package.json` desfasada | Sin `@semantic-release/git`, sync manual tras bumps; el tag manda. |
| Token 403 al cambiar email | Esperado: usar UI + 2FA, no el automation token. |

## Seguridad

- **No hay `NPM_TOKEN` en GitHub Actions.**
- **Cache poisoning deshabilitado** en el path de release.
- **Provenance** automático con Trusted Publishing en repos públicos.
- Tras usar un token de bootstrap local: **revocarlo** en npmjs (quedó expuesto en sesión de operador).
