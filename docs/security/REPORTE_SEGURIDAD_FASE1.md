# Reporte de fixes de seguridad — Fase 1

**Rama:** `fix/seguridad-fase-1` (creada desde `main`, sincronizada con `origin/main` vía fast-forward).  
**No se hizo push.**

## Hallazgos cerrados

| Severidad | Hallazgo | Archivo(s) | Línea(s) / área | Fix aplicado |
|-----------|----------|------------|-----------------|--------------|
| ALTO | `compareTokens` acortaba por diferencia de longitud, revelando longitud del secreto vía timing. | `src/auth.ts` | 7-8 (original) | Reescrita con HMAC-SHA256 + `crypto.timingSafeEqual`. No se retorna false por longitud; los digestos siempre son de 32 bytes. |
| ALTO | `keyGenerator` usaba `req.ip` directamente sin normalizar IPv6. | `src/http.ts` | 71 (original) | Importado `ipKeyGenerator` de `express-rate-limit` y usado como fallback: `extractBearer(...) \|\| ipKeyGenerator(req.ip ?? "") \|\| "anon"`. |
| ALTO | `cache: npm` en job de pre-publicación de `release.yml`. | `.github/workflows/release.yml` | 37-40 (original) | Eliminado `cache: npm` del job `verify-light`; añadido comentario explicando el riesgo de cache-poisoning previo al release. |
| ALTO | Desincronización con `origin/main` (9 commits atrás). | Todo el repo | — | `git pull origin main` ejecutado en la rama de fix; fast-forward sin conflictos. |
| MEDIO | Versiones hardcodeadas en `src/server.ts` y `src/http.ts`. | `src/server.ts`, `src/http.ts`, `src/version.ts` | 119, 151 (original) | Sincronizado con `origin/main`: se creó `src/version.ts` que lee `package.json` en runtime; reemplazados los literales `"0.3.0"` y `"0.2.0"`. |
| MEDIO | `trash_path` default "Trash" sin auto-detectar buzón `\Trash`. | `src/server.ts` | 792-795 (original) | Sincronizado con `origin/main`: añadida `resolveTrashPath()` que busca `specialUse === "\\Trash"` antes de fallback a "Trash". |
| MEDIO | `since`/`before` sin validación ISO. | `src/server.ts` | 303-310 / 340-341 (original) | Sincronizado con `origin/main`: añadido `.refine((v) => !Number.isNaN(Date.parse(v)), "Invalid ISO date")` en ambos campos. |
| BAJO | `Dockerfile` usaba `node:26-alpine`. | `Dockerfile` | 2, 11 | Cambiado a `node:22-alpine` (LTS activa) en ambos stages (builder + runtime). |
| BAJO | `Dockerfile.bridge` usaba imagen flotante. | `Dockerfile.bridge` | 10 | Añadido digest SHA multi-arquitectura de `shenxn/protonmail-bridge:build@sha256:514d19e289e039fb22e0a8196faaf4e84e4a1805de359ef8fa704785bb5783a1`. |
| BAJO | Enlaces rotos/desactualizados a paths antiguos del repo. | `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `docs/deployment-http-docker.md` | Varios | Actualizadas URLs a `Iniciativas-Alexendros/plugin-protonmail-claudecode`. Ajustado `node:20-alpine` → `node:22-alpine` en docs. Creado `.lycheeignore` para excluir npm (403 en bots). |
| BAJO | Licencias copyleft no documentadas. | `LICENSE` | — | Añadida nota de dependencias: árbol de producción revisado; todas son permisivas. `@zone-eu/mailsplit` es dual MIT OR EUPL-1.1+, consumido bajo MIT. |
| BAJO | Complejidad ciclomática en `src/config.ts` y `src/server.ts`. | `src/config.ts`, `src/server.ts` | 55, 259 (original) | Sincronizado con `origin/main`: `server.ts` ya introdujo helpers `register` y `resolveTrashPath`. `config.ts`: extraídos helpers `readInt`, `readBool`, `readCsv` para reducir la función `loadConfig`. |

## Verificaciones ejecutadas

```bash
npm install --no-audit --no-fund   # OK
npm run build                       # OK (tsc sin errores)
npm test                            # OK — 125 tests, 7 ficheros, 0 fallos
npm audit --audit-level=high        # OK — 0 vulnerabilidades
```

## Archivos cambiados en la rama

- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/workflows/release.yml`
- `.lycheeignore` (nuevo)
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `Dockerfile`
- `Dockerfile.bridge`
- `LICENSE`
- `REPORTE_SEGURIDAD_FASE1.md` (nuevo, este informe)
- `SUPPORT.md`
- `docs/deployment-http-docker.md`
- `src/auth.ts`
- `src/config.ts`
- `src/http.ts`

Cambios provenientes de `origin/main` (ya incorporados tras el pull):

- `src/version.ts` (nuevo)
- `src/server.ts` (uso de `VERSION`, `resolveTrashPath`, `.refine` ISO, wrapper `register`)
- `src/addresses.ts`, `src/imap.ts`, `src/smtp.ts`, tests E2E, etc.

## Pendientes / notas para el operador

- No se hizo push. Revisar localmente antes de mergear.
- El `Dockerfile.bridge` pincha a un digest multi-arquitectura actual al 2025-04-02. Si `shenxn/protonmail-bridge:build` publica una nueva versión, habrá que refrescar el digest.
- La cache de npm también sigue presente en `ci.yml`, `audit.yml` y `e2e.yml`. El informe de seguridad P1 señalaba específicamente `release.yml`; se recomienda evaluar si se elimina también en CI por coherencia.
- Los tests E2E (`npm run test:e2e`) requieren un Bridge/GreenMail real; no se ejecutaron en este paso porque no es parte del checklist base, pero el workflow `ci.yml` los cubre con el servicio GreenMail.
- El cambio de `compareTokens` a HMAC-SHA256 es funcionalmente compatible con los tests existentes; los 11 tests de `auth.test.ts` pasan.
