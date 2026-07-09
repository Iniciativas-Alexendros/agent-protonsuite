# Scenarios: Profesionalización y estandarización

## Happy paths

### HP1 — ESLint pasa en código limpio
**Dado** el código fuente actual sin modificar
**Cuando** ejecuto `npm run lint`
**Entonces** no hay errores (0 exit code)
**Y** los warnings son informativos, no bloqueantes

### HP2 — ESLint corrige problemas auto-fixables
**Dado** código con `import { Foo } from "./bar"` (sin extensión .js)
**Cuando** ejecuto `npm run lint:fix`
**Entonces** el import se corrige a `import { Foo } from "./bar.js"`
**Y** `npm run lint` subsecuente no reporta ese warning

### HP3 — commitlint acepta mensaje convencional
**Dado** un commit con mensaje `feat(pass): add audit command`
**Cuando** Husky ejecuta commitlint en pre-commit
**Entonces** el commit se acepta

### HP4 — commitlint rechaza mensaje no convencional
**Dado** un commit con mensaje `added some stuff`
**Cuando** Husky ejecuta commitlint en pre-commit
**Entonces** el commit se rechaza con mensaje de error descriptivo

### HP5 — Knip reporta 0 problemas en código limpio
**Dado** el código fuente sin dependencias/imports sin usar
**Cuando** ejecuto `npm run knip`
**Entonces** exit code 0
**Y** sin errores de `files`, `dependencies`, `exports`

### HP6 — semantic-release dry-run exitoso
**Dado** configuración `.releaserc.json` válida
**Y** token GITHUB_TOKEN en entorno
**Cuando** ejecuto `npx semantic-release --dry-run --no-ci`
**Entonces** reporta la próxima versión sin publicar
**Y** exit code 0

### HP7 — CI incluye paso de lint
**Dado** un push a cualquier rama
**Cuando** CI ejecuta el workflow
**Entonces** el paso `lint` corre ESLint y falla si hay errores
**Y** el paso `knip` en quality.yml corre Knip y falla si hay dependencias sin usar

### HP8 — Tests existentes siguen pasando
**Dado** todas las nuevas configuraciones instaladas
**Cuando** ejecuto `npm test`
**Entonces** 150/150 tests pasan
**Y** `npm run typecheck` pasa
**Y** `npm run build` genera dist/
**Y** `npm run smoke` reporta OK

## Edge cases

### EC1 — Archivos de configuración excluidos de Knip
**Dado** `eslint.config.ts`, `commitlint.config.ts`, `knip.config.ts`
**Cuando** Knip analiza el proyecto
**Entonces** estos archivos NO se reportan como "unused files"
**Porque** están en `ignore` en `knip.config.ts`

### EC2 — Tests con promesas no esperadas no rompen lint
**Dado** `tests/server-tools.test.ts` con `await expect(...).rejects...`
**Cuando** ESLint analiza archivos de test
**Entonces** `@typescript-eslint/no-floating-promises` NO reporta error
**Porque** los tests tienen reglas relajadas en `eslint.config.ts`

### EC3 — semantic-release no dispara en branches no-main
**Dado** un push a rama `feature/xyz`
**Cuando** CI ejecuta release.yml
**Entonces** semantic-release NO publica
**Porque** la config limita a `branches: ["main"]`

### EC4 — Primer release con semantic-release preserva CHANGELOG histórico
**Dado** CHANGELOG.md existente con entradas manuales v0.1.0-v0.6.0
**Cuando** semantic-release genera su primer release (v0.7.0)
**Entonces** el CHANGELOG.md mantiene las entradas históricas arriba
**Y** la nueva entrada v0.7.0 se inserta debajo del header

### EC5 — lint-staged solo analiza archivos .ts staged
**Dado** `git add src/server.ts` y `git add README.md`
**Cuando** Husky ejecuta lint-staged en pre-commit
**Entonces** ESLint corre solo sobre `src/server.ts`
**Y** `README.md` no se analiza (no es .ts)

### EC6 — Renovate auto-merge solo para devDependencies
**Dado** PR de Renovate para `vitest` (devDep, patch bump)
**Y** CI verde en el PR
**Cuando** Renovate evalúa auto-merge
**Entonces** el PR se mergea automáticamente
**Dado** PR de Renovate para `@modelcontextprotocol/sdk` (dep, minor bump)
**Y** CI verde en el PR
**Cuando** Renovate evalúa auto-merge
**Entonces** el PR NO se mergea automáticamente (requiere revisión humana)

## Errores esperados

### ER1 — ESLint rechaza código con errores type-checked
**Dado** `src/server.ts` con `const x: number = "string"`
**Cuando** ejecuto `npm run lint`
**Entonces** ESLint reporta error `@typescript-eslint/...`
**Y** exit code != 0

### ER2 — commitlint rechaza scope inválido
**Dado** commit `feat(foo): add something`
**Cuando** commitlint analiza el mensaje
**Entonces** error: `scope "foo" no está en la lista permitida`

### ER3 — Knip detecta dependencia no usada
**Dado** `package.json` con `"some-lib": "^1.0.0"` en dependencies
**Y** ningún archivo en `src/` importa `some-lib`
**Cuando** ejecuto `npm run knip`
**Entonces** Knip reporta `some-lib` como unused dependency
**Y** exit code != 0

### ER4 — semantic-release falla sin GITHUB_TOKEN
**Dado** entorno sin `GITHUB_TOKEN`
**Cuando** CI ejecuta `npx semantic-release`
**Entonces** error de autenticación
**Y** el paso falla (esperado en dry-run local)
