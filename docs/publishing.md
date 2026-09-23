# Publicación a npm y GHCR

Abrir cuando: Configuras Trusted Publishing, diagnosticas un Release rojo o
reactivas `npmPublish`.
Aprobado: 23 de septiembre de 2026
Autoridad: Operativa
Estado: Aprobado
Propósito: Contrato de publicación (GitHub Release + GHCR ahora; npm cuando exista).

Este documento describe cómo se publica `@alexendros/protonsuite-agent`.
**No se usa `NPM_TOKEN`.** npm queda detrás de OIDC Trusted Publishing, pero el
paquete **aún no existe** en el registry (OIDC 404 `package not found` el
2026-09-23). Hasta entonces `npmPublish` es `false` y Release no debe fallar.

## Cómo funciona

1. Cada push a `main` dispara `release.yml` → `semantic-release` analiza commits.
2. Si hay un `feat:`, `fix:` o `BREAKING CHANGE:` desde el último tag, se crea
   una nueva versión (GitHub Release + tag `vX.Y.Z`).
3. `semantic-release` actualiza `CHANGELOG.md` en el job; no hace push a `main`
   (`@semantic-release/git` omitido: rama protegida, GH006).
4. `@semantic-release/npm` genera el tarball (`tarballDir: dist`) pero
   **no publica** (`npmPublish: false`).
5. Si hay release nueva, el job `publish-ghcr` construye desde el tag `vX.Y.Z` y
   publica `:latest`, `:X.Y.Z`, `:X.Y` y `:sha-…`.
6. PRs que tocan el workflow corren `semantic-release --dry-run` (sin publicar).

## Decisión: no fallar por npm ausente

| Hecho | Consecuencia |
| --- | --- |
| `npm view @alexendros/protonsuite-agent` → 404 | No hay paquete ni Trusted Publisher pendiente usable |
| `@semantic-release/npm` con `npmPublish: true` | `verifyConditions` exige OIDC o `NPM_TOKEN` **aunque no haya bump** |
| Este repo no inventa `NPM_TOKEN` | El job `release` no debe poner un token a mano |

Por eso `.releaserc.json` usa `npmPublish: false`. El workflow emite un
`::notice::` si el paquete sigue ausente. GitHub Release + GHCR son la
superficie de release actual.

## Reactivar npm (cuando el paquete exista)

1. En [npmjs.com](https://npmjs.com), crea un **Trusted Publisher pendiente**
   (o publica a mano la primera versión) para `@alexendros/protonsuite-agent`:
   - **Repository**: `Iniciativas-Alexendros/agent-protonsuite`
   - **Workflow**: `release.yml`
   - **Environment**: (opcional) `npm`
2. Confirma `npm view @alexendros/protonsuite-agent version`.
3. Cambia `.releaserc.json` a `"npmPublish": true`.
4. No añadas `NPM_TOKEN`. El job ya tiene `id-token: write`.

## Cómo publicar una nueva versión (GitHub + GHCR)

```bash
git commit -m "feat: nueva funcionalidad"
# o
git commit -m "fix: corrección de bug"
git push origin main
```

`release.yml` hará automáticamente:

- Análisis de commits → MAJOR/MINOR/PATCH
- Tag `vX.Y.Z` + GitHub Release
- Imagen Docker a GHCR (si hubo versión nueva)

## Verificar publicación

```bash
# Tag / GitHub Release (fuente de verdad hoy)
gh release view --repo Iniciativas-Alexendros/agent-protonsuite

# npm (404 esperado hasta reactivar Trusted Publishing)
npm view @alexendros/protonsuite-agent version
```

## Troubleshooting

| Problema | Solución |
| --- | --- |
| `EINVALIDNPMTOKEN` / `401 whoami` | `npmPublish` se reactivó sin paquete/OIDC. Volver a `false` o completar Trusted Publishing. **No** añadir `NPM_TOKEN`. |
| `404 OIDC token exchange` | El paquete no existe o no hay Trusted Publisher. Ver sección anterior. |
| `npm publish` no se ejecuta | Esperado mientras `npmPublish: false`. |
| Commit `chore:`/`docs:` no crea tag | Correcto: no hay bump. El workflow debe quedar verde. |
| Version en `package.json` desfasada | Esperado sin `@semantic-release/git`. El tag manda. |

## Seguridad

- **No se usa `NPM_TOKEN`**: no hay secreto de npm que rotar ni filtrar.
- **Cache poisoning deshabilitado**: sin `package-manager-cache` en el path de release.
