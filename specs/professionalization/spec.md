# Spec: Profesionalización y estandarización del proyecto

## Objetivo

Convertir `agent-protonsuite` en un proyecto TypeScript de nivel profesional siguiendo los estándares del ecosistema 2025-2026, sin cambiar la API pública de tools ni la arquitectura de transporte.

## Alcance

- **Dentro:** ESLint flat config, commitlint + Husky, Knip, lint-staged, semantic-release, Renovate config, actualización de CI, estandarización de scripts npm.
- **Fuera:** Monorepo, TypeScript project references, cambios en tools/schemas, nuevos productos.

## Requerimientos funcionales

### RF1 — ESLint flat config con reglas estrictas

El proyecto debe tener un `eslint.config.ts` que aplique:
- `@eslint/js` recommended
- `typescript-eslint` strict + stylistic
- `eslint-plugin-unicorn` (reglas seleccionadas)
- `eslint-plugin-security` (reglas seleccionadas)
- `eslint-plugin-import-x` (orden de imports)
- Ignorar `dist/`, `node_modules/`, `coverage/`

El script `npm run lint` debe ejecutar ESLint. El script `npm run lint:fix` debe auto-corregir.

### RF2 — commitlint con conventional commits

- `commitlint.config.ts` con `@commitlint/config-conventional`
- Scopes permitidos: `imap`, `smtp`, `http`, `agent`, `alerts`, `pass`, `config`, `deps`, `release`, `ci`, `docs`, `tests`
- Husky hook `commit-msg` que ejecute commitlint
- Husky hook `pre-commit` que ejecute lint-staged

### RF3 — Knip para detección de código muerto

- `knip.config.ts` que verifique: dependencias no usadas, imports no usados, archivos no referenciados
- Script `npm run knip` para ejecución manual
- Integración en CI como paso del workflow `quality.yml`

### RF4 — lint-staged para pre-commit rápido

- Solo ejecutar ESLint + Knip sobre archivos staged
- Configuración en `package.json` o `.lintstagedrc.json`

### RF5 — semantic-release para releases automatizados

- `.releaserc.json` con plugins: `@semantic-release/commit-analyzer`, `@semantic-release/release-notes-generator`, `@semantic-release/changelog`, `@semantic-release/npm`, `@semantic-release/github`
- Branch principal: `main`
- El CHANGELOG.md se genera automáticamente desde los conventional commits
- El version bump se deriva de los commits desde el último release
- La publicación a npm usa OIDC (ya configurado, sin cambios)

### RF6 — Renovate para mantenimiento de dependencias

- `renovate.json5` con: actualizaciones agrupadas, auto-merge para devDependencies con CI verde, lockfile maintenance semanal
- Mantener Dependabot para alertas de seguridad (GitHub-native)

### RF7 — Actualización de CI

- `quality.yml`: añadir paso `lint` (ESLint) y `knip`
- `ci.yml`: añadir paso `lint` antes de typecheck
- `release.yml`: reemplazar proceso manual por semantic-release (mantener OIDC, provenance, SBOM)

### RF8 — Estandarización de scripts npm

Unificar y documentar todos los scripts en `package.json`:
- `lint`, `lint:fix`, `format`, `format:check`
- `knip`
- `prepare` (husky install)

## Criterios de aceptación

1. `npm run lint` reporta 0 errores en todo el código fuente (puede haber warnings iniciales)
2. `npm run lint:fix` corrige problemas auto-fixables
3. `npx commitlint --from HEAD~1` valida el último commit
4. `git commit` rechaza mensajes no convencionales (vía hook)
5. `npx knip` reporta 0 unused dependencies y 0 unused files
6. `npm test` + `npm run typecheck` + `npm run build` + `npm run smoke` siguen pasando
7. semantic-release config válida (`npx semantic-release --dry-run` no da errores)
8. `renovate-config-validator` valida `renovate.json5`
9. CI pasa todos los pasos nuevos (lint, knip)
10. No hay cambios en la API de tools ni en los schemas de entrada/salida

## Restricciones

- Node.js >= 22 (sin cambios)
- TypeScript ^5.8 (sin cambios)
- No breaking changes en tools MCP
- No cambios en dependencias de producción
- 150 tests existentes deben seguir pasando
- Build + smoke deben seguir pasando

## No-objetivos

- No migrar a monorepo
- No añadir Prettier (ESLint stylistic cubre formato)
- No cambiar a pnpm/yarn (npm workspaces existente se mantiene)
- No modificar `src/pass.ts`, `src/imap.ts`, `src/smtp.ts`, `src/server.ts`
- No cambiar la estructura de directorios `src/`
