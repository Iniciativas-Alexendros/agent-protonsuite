# Test Plan: Profesionalización y estandarización

## Orden de ejecución

Los tests se ejecutan en este orden porque cada capa valida la anterior:

1. **Config validation** — ¿Se instalan las herramientas? ¿Las configs son sintácticamente válidas?
2. **Lint** — ¿ESLint pasa en el código existente?
3. **Conventional commits** — ¿commitlint acepta/rechaza correctamente?
4. **Dead code** — ¿Knip reporta 0 problemas?
5. **Semantic-release** — ¿Config válida y dry-run funciona?
6. **CI simulation** — ¿Los pasos nuevos en CI no rompen nada?
7. **Regression** — ¿Tests existentes, typecheck, build, smoke intactos?

---

## Test Suite 1: Validación de configuración

### T1.1 — eslint.config.ts es sintácticamente válido
- **Tipo:** Unit (validación estática)
- **Archivo:** `eslint.config.ts`
- **Comando:** `node -e "require('typescript-eslint')"` + verificación manual
- **Esperado:** ESLint se ejecuta sin errores de configuración

### T1.2 — commitlint.config.ts es sintácticamente válido
- **Tipo:** Unit
- **Comando:** `npx commitlint --print-config`
- **Esperado:** Imprime config sin errores

### T1.3 — knip.config.ts es sintácticamente válido
- **Tipo:** Unit
- **Comando:** `npx knip --no-progress` (dry-run)
- **Esperado:** Knip se ejecuta sin crash

### T1.4 — .releaserc.json es JSON válido
- **Tipo:** Unit
- **Comando:** `node -e "JSON.parse(require('fs').readFileSync('.releaserc.json','utf8'))"`
- **Esperado:** No lanza excepción

### T1.5 — renovate.json5 es válido
- **Tipo:** Unit
- **Comando:** `npx renovate-config-validator`
- **Esperado:** Exit code 0

### T1.6 — .lintstagedrc.json es JSON válido
- **Tipo:** Unit
- **Comando:** `node -e "JSON.parse(require('fs').readFileSync('.lintstagedrc.json','utf8'))"`
- **Esperado:** No lanza excepción

---

## Test Suite 2: ESLint

### T2.1 — ESLint pasa en src/
- **Tipo:** Static analysis
- **Comando:** `npm run lint`
- **Esperado:** Exit code 0. Warnings aceptables, 0 errors.

### T2.2 — ESLint auto-fix funciona
- **Tipo:** Static analysis
- **Comando:** `npm run lint:fix`
- **Esperado:** Exit code 0. Archivos modificados si había problemas auto-fixables.

### T2.3 — ESLint detecta error type-checked
- **Tipo:** Static analysis
- **Setup:** Insertar `const x: number = "oops"` en un archivo temporal, borrar después.
- **Comando:** `npm run lint`
- **Esperado:** Exit code != 0. Error reportado.

### T2.4 — ESLint ignora dist/ y node_modules/
- **Tipo:** Static analysis
- **Verificación:** `eslint.config.ts` tiene `ignores: ['dist/', 'node_modules/', ...]`
- **Esperado:** ESLint no analiza archivos en esas carpetas.

---

## Test Suite 3: commitlint

### T3.1 — commitlint acepta mensaje válido
- **Tipo:** Unit
- **Comando:** `echo "feat(pass): add audit command" | npx commitlint`
- **Esperado:** Exit code 0

### T3.2 — commitlint rechaza tipo inválido
- **Tipo:** Unit
- **Comando:** `echo "add stuff" | npx commitlint`
- **Esperado:** Exit code != 0. Mensaje de error descriptivo.

### T3.3 — commitlint rechaza scope inválido
- **Tipo:** Unit
- **Comando:** `echo "feat(foobar): add thing" | npx commitlint`
- **Esperado:** Exit code != 0. Mensaje mencionando scopes permitidos.

### T3.4 — commitlint acepta breaking change
- **Tipo:** Unit
- **Comando:** `printf "feat(imap)!: drop TLS 1.2\n\nBREAKING CHANGE: requires TLS 1.3" | npx commitlint`
- **Esperado:** Exit code 0

---

## Test Suite 4: Knip

### T4.1 — Knip reporta 0 unused dependencies
- **Tipo:** Static analysis
- **Comando:** `npm run knip`
- **Esperado:** Exit code 0. Sin errores de tipo `dependencies` o `files`.

### T4.2 — Knip ignora archivos de configuración
- **Tipo:** Static analysis
- **Verificación:** `eslint.config.ts`, `commitlint.config.ts`, `knip.config.ts` en `knip.config.ts` → `ignore`
- **Esperado:** No reportados como "unused files"

---

## Test Suite 5: semantic-release

### T5.1 — semantic-release dry-run no da error
- **Tipo:** Integration
- **Comando:** `npx semantic-release --dry-run --no-ci` (con GITHUB_TOKEN de prueba)
- **Esperado:** Exit code 0. Reporta versión sin publicar.

### T5.2 — .releaserc.json sin errores de schema
- **Tipo:** Validation
- **Comando:** `npx semantic-release --dry-run --no-ci 2>&1 | grep -i error`
- **Esperado:** Sin errores de configuración.

---

## Test Suite 6: CI simulation

### T6.1 — Paso lint en CI no rompe
- **Tipo:** Integration
- **Simulación:** Ejecutar secuencialmente `npm ci && npm run lint && npm run typecheck`
- **Esperado:** Todos pasan.

### T6.2 — Paso knip en CI no rompe
- **Tipo:** Integration
- **Simulación:** Ejecutar `npm run knip`
- **Esperado:** Exit code 0.

---

## Test Suite 7: Regression

### T7.1 — Tests existentes intactos
- **Tipo:** Regression
- **Comando:** `npm test`
- **Esperado:** 150/150 tests pasan.

### T7.2 — Typecheck intacto
- **Tipo:** Regression
- **Comando:** `npm run typecheck`
- **Esperado:** Exit code 0. Sin nuevos errores.

### T7.3 — Build intacto
- **Tipo:** Regression
- **Comando:** `npm run build`
- **Esperado:** Exit code 0. `dist/` generado.

### T7.4 — Smoke test intacto
- **Tipo:** Regression
- **Comando:** `npm run smoke`
- **Esperado:** `[smoke] OK · initialize + 15 tools listed`

### T7.5 — npm pack incluye archivos correctos
- **Tipo:** Regression
- **Comando:** `npm pack --dry-run 2>&1`
- **Esperado:** Incluye `dist/`, `server.json`, `README.md`, `docs/`, `playbooks/`, `connectors/`. NO incluye `src/`, `tests/`, `.github/`.

---

## Cobertura por módulo

| Módulo | ¿Cambia? | Tests afectados |
|--------|----------|-----------------|
| `src/*.ts` | No | Solo lint (T2.1) |
| `tests/*.ts` | No | Solo lint (T2.1, reglas relajadas) |
| `package.json` | Sí (scripts, devDeps) | T7.5 (npm pack), T6.1 (lint en CI) |
| `.github/workflows/*.yml` | Sí (pasos nuevos) | T6.1, T6.2 |
| `CHANGELOG.md` | Sí (reducido) | Ningún test lo cubre |
| `RELEASE.md` | Sí (procedimiento) | Ningún test lo cubre |
| `CONTRIBUTING.md` | Sí (sección nueva) | Ningún test lo cubre |

## Notas

- No se añaden tests unitarios nuevos porque las herramientas (ESLint, commitlint, Knip, semantic-release) son software externo ya testeado. Los tests de este plan validan la **integración** de esas herramientas en el proyecto.
- Si `npm run lint` produce errores en el código existente, se corrigen con `lint:fix` o manualmente antes de declarar verde.
- Si Knip detecta dependencias no usadas, se eliminan de `package.json` antes de declarar verde.
