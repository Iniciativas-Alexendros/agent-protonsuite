# TASKS — Proton Suite Agent

> **Estado actual:** worktree `freebuff/new-thread-thmrqm6q6bhp81` basado en `main@5b2f058`
> **Última actualización:** 18 julio 2026

---

## Resumen ejecutivo

Proyecto MCP server multi-producto para **Proton Suite** (Mail/Bridge, Pass, Drive, Calendar). 49 módulos TypeScript, **90.67% cobertura** (635 tests, todos pasando), CI/CD con pnpm, Docker multi-stage, semantic-release.

### Línea base

| Métrica | Valor |
|---------|-------|
| Versión | `v0.7.0` |
| Statements | **90.67%** |
| Branches | 86.72% |
| Functions | **92.2%** |
| Tests | **635 pass / 39 files** |
| Source files | 49 en `src/` |
| Dependencias | 6 runtime, 18 dev |
| Node | ≥22, TypeScript strict |

### Estado del worktree

```
19 modified files (+6,091 / -16,826 líneas)
+30 untracked files (tests nuevos, config/, docs/)
```

---

## Lo completado en este worktree

### Fase 1 — Higiene del repositorio

| Tarea | Estado |
|-------|--------|
| Eliminar `package-lock.json` + `.gitignore` | ✅ |
| Mover `REPORTE_SEGURIDAD_FASE1.md` → `docs/security/` | ✅ |
| Revisar `server.json` (contiene solo config de plantilla, sin secretos) | ✅ |
| Expandir `agent-cli.ts` con `--help`, subcomandos, exit codes | ✅ |
| Completar `calendar-types.ts` con tipos CalDAV RFC 5545 | ✅ |
| Evaluar `pass/` vs `src/pass.ts` (sin duplicación, se mantiene `pass/`) | ✅ |

### Fase 2 — Infraestructura de tests

| Tarea | Estado |
|-------|--------|
| Unificar 3 configs vitest (config, e2e, integration) | ✅ |
| Tests para `drive-audit.ts`, `security.ts`, `diagnostics.ts` | ✅ |
| Tests para `agent/organizer.ts` con mock ImapClient (9→17 tests) | ✅ |
| Tests para `agent/executor.ts` (30%→93%) | ✅ |
| Tests para `server/suite.ts` (16%→98%) | ✅ |
| Tests para `server/utils.ts` (37%→100%) | ✅ |
| Tests para `server/mail.ts` (→100%) | ✅ |
| Tests para `server/ecosystem.ts` (17%→100%) | ✅ |
| Tests para `agent/setup.ts` (3%→100%) | ✅ |
| Tests para `server/agent.ts` (64%→100%) | ✅ |
| Tests para `http.ts` (69→81%, +14 tests) | ✅ |
| Tests para `alerts/rules.ts` (71%→100%) | ✅ |

### Fase 3 — Coverage Hunt (5 tasks)

| Módulo | Antes | Ahora | Tests |
|--------|-------|-------|-------|
| `ecosystem/discovery.ts` | 7.33% | **93.57%** | 40 |
| `ecosystem/installer.ts` | 7.69% | **100%** | 18 |
| `ecosystem/updater.ts` | 5.35% | **96.42%** | 22 |
| `alerts/ntfy.ts` | 3.70% | **100%** | 7 |
| `alerts/webhook.ts` | 7.69% | **100%** | 4 |

### Fase 4 — Segunda ronda (6 módulos)

| Módulo | Antes | Ahora | Tests |
|--------|-------|-------|-------|
| `which.ts` | 49% | **100%** | 13 |
| `ecosystem/binaries.ts` | 50% | **100%** | 14 |
| `pass.ts` | 60% | **99.1%** | 25 |
| `drive.ts` | 60% | **94.37%** | 24 |
| `server/pass.ts` | 60% | **99.56%** | 15 |
| `server/drive.ts` | 59% | **89.14%** | 23 |

### Fase 5 — Migración npm→pnpm

| Tarea | Estado |
|-------|--------|
| Migrar `.github/workflows/ci.yml` (npm ci → pnpm --frozen-lockfile) | ✅ |
| Migrar `.github/workflows/quality.yml` | ✅ |
| Migrar `.github/workflows/release.yml` | ✅ |
| Migrar `.github/workflows/integration.yml` | ✅ |
| Migrar `Dockerfile` a multi-stage con pnpm | ✅ |
| Añadir `pnpm/action-setup` en todos los jobs | ✅ |
| Añadir `pnpm.onlyBuiltDependencies` al `package.json` | ✅ |

### Fase 6 — Split de config.ts

| Módulo creado | Propósito |
|---------------|-----------|
| `src/config/index.ts` | Barrel export |
| `src/config/imap.ts` | IMAP config schema (schema + parse) |
| `src/config/smtp.ts` | SMTP config schema |
| `src/config/pass.ts` | Pass config schema |
| `src/config/calendar.ts` | Calendar config schema |
| `src/config/drive.ts` | Drive config schema |
| `src/config/bridge.ts` | Bridge config schema |

---

## Progreso de cobertura (evolución)

| Fecha | Statements | Tests | Archivos | Hitos |
|-------|-----------|-------|----------|-------|
| **Jul 2026 (actual)** | **90.67%** | **635** | **39** | 6 módulos en ronda 2, organizer 17 tests, http +14 tests |
| Jul 2026 | 88.02% | 579 | 38 | which→100%, binaries→100%, pass→99%, drive→94% |
| Jul 2026 | 79.66% | 483 | 32 | ecosystem 5 tasks completadas (7%→100%) |
| Jul 2026 | 75.36% | 422 | 27 | organizer 68%, executor 93%, setup 100%, mail 100% |
| Jun 2026 | 63.6% | 270 | 23 | +12 tests organizer |
| Jun 2026 (base) | 61.7% | 258 | 21 | Reporte inicial |

---

## Archivos de test (39 totales)

### Tests nuevos creados en este worktree (~20)

| Archivo | Tests | Módulo cubierto |
|---------|-------|-----------------|
| `tests/agent/organizer.test.ts` | 17 | `agent/organizer.ts` (98%) |
| `tests/diagnostics.test.ts` | 2 | `diagnostics.ts` (93%) |
| `tests/executor.test.ts` | 6 | `agent/executor.ts` (93%) |
| `tests/organizer.test.ts` | — | _(obsoleto, reemplazado por agent/organizer.test.ts)_ |
| `tests/security.test.ts` | 4 | `security.ts` (100%) |
| `tests/server/agent.test.ts` | 5 | `server/agent.ts` (100%) |
| `tests/server/drive.test.ts` | 23 | `server/drive.ts` (89%) |
| `tests/server/ecosystem.test.ts` | 13 | `server/ecosystem.ts` (100%) |
| `tests/server/mail.test.ts` | 12 | `server/mail.ts` (100%) |
| `tests/server/pass.test.ts` | 15 | `server/pass.ts` (99%) |
| `tests/server/suite.test.ts` | 14 | `server/suite.ts` (98%) |
| `tests/server/utils.test.ts` | 2 | `server/utils.ts` (100%) |
| `tests/setup.test.ts` | 8 | `agent/setup.ts` (100%) |
| `tests/which.test.ts` | 13 | `which.ts` (100%) |
| `tests/ecosystem/discovery.test.ts` | 40 | `ecosystem/discovery.ts` (93%) |
| `tests/ecosystem/installer.test.ts` | 18 | `ecosystem/installer.ts` (100%) |
| `tests/ecosystem/updater.test.ts` | 22 | `ecosystem/updater.ts` (96%) |
| `tests/ecosystem/binaries.test.ts` | 14 | `ecosystem/binaries.ts` (100%) |
| `tests/alerts/ntfy.test.ts` | 7 | `alerts/ntfy.ts` (100%) |
| `tests/alerts/webhook.test.ts` | 4 | `alerts/webhook.ts` (100%) |

### Tests ampliados en este worktree

| Archivo | Antes | Ahora | Cambio |
|---------|-------|-------|--------|
| `tests/pass.test.ts` | 0 | 25 | Tests nuevos completos |
| `tests/drive.test.ts` | 0 | 24 | Tests nuevos completos |
| `tests/http-transport.test.ts` | 8 | 22 | +14 (CORS, sessions, auth, errors) |
| `tests/alerts/rules.test.ts` | 0 | 20 | Nuevos (antes eran inline en alerts.test.ts) |

---

## Pendiente — priorizado

### 🔴 Prioridad alta (sube cobertura >1pp)

#### 1. `src/server.ts` — 73.64% stmts, 64.7% branches

El módulo principal del MCP server. Requiere mockear `createServer`, `listen`, config load completa. Es el de más impacto potencial (~+2pp).

**Enfoque sugerido:** ~30 tests cubriendo:
- Arranque con transporte stdio vs HTTP
- Arranque con config válida vs inválida
- Carga de config desde env vs file
- Error handling en startup (puerto ocupado, config inválida)
- Shutdown graceful (signal handlers)
- Registro condicional de tools por producto habilitado

#### 2. `src/config.ts` — 79.23% stmts, 73.68% funcs

La fachada `loadConfig` + `createLogger`. Tras el split, queda como módulo delgado pero crítico.

**Enfoque sugerido:** ~15 tests:
- `loadConfig` con env sobreescribiendo defaults de file
- Merge de schemas parciales (solo Mail habilitado, solo Pass, etc.)
- `createLogger` con distintos niveles
- Errores de parseo Zod
- Carga de config desde ruta personalizada

#### 3. `src/smtp.ts` — 79.8% stmts, **40.9% branches**

Branches muy bajas. El pool SMTP tiene múltiples caminos condicionales.

**Enfoque sugerido:** ~15 tests:
- `send` con texto plano vs HTML
- `reply` preservando threading headers
- `forward` con/sin adjuntos originales
- `send` con STARTTLS ok/fallo
- `send` con SSL directo
- `send` con auth inválida
- Pool reutilizado vs nueva conexión
- Timeout de conexión

#### 4. `src/bridge/bridge-client.ts` — 80% stmts, 75.28% branches

Cliente MCP para el Bridge. Mockear transporte stdio.

**Enfoque sugerido:** ~15 tests:
- `listTools` con respuesta válida
- `callTool` con args correctos
- Timeout de respuesta
- Error de conexión (Bridge caído)
- Reconexión automática
- Parsing de respuestas JSON-RPC inválidas

---

### 🟡 Prioridad media (sube cobertura <1pp)

#### 5. `src/alerts/index.ts` — 76% stmts, 61.53% branches

AlertSystem con múltiples sinks.

**Enfoque sugerido:** ~10 tests:
- Init con sinks file/ntfy/webhook combinados
- Emit con severidades variadas
- Filtro por minSeverity
- Error handling cuando un sink falla (no debe romper otros sinks)
- Close/cleanup

#### 6. `src/config/drive.ts` — 82.14% stmts, 66.66% branches

**Enfoque sugerido:** ~5 tests:
- Parsing de config Drive desde env
- StagingDir default vs custom
- Branch `DRIVE_ENABLED` true/false

#### 7. `src/http.ts` — 81.65%, **falta catch block + idle eviction**

Las 14 nuevas pruebas cubren CORS, sessions, auth, errores. Quedan:
- Idle eviction de sesiones (30 min)
- Catch block interno (requiere mock de McpServer.connect que rechace)

#### 8. `src/server/drive.ts` — 89.14% stmts, 67.53% branches

**Enfoque sugerido:** ~10 tests para error paths:
- Error paths: `proton_drive_create_folder`, `proton_drive_remove`, `proton_drive_copy`
- `proton_drive_upload` con error
- `proton_drive_organize` dry_run=false

---

### 🟢 Prioridad baja/backlog

#### 9. Stubs sin cobertura (intencional)

| Archivo | Stmts | Nota |
|---------|-------|------|
| `agent-cli.ts` | 0% | CLI entry point, no crítico |
| `calendar-types.ts` | 0% | Tipos CalDAV, stub |
| `calendar.ts` | 0% | CalendarClient stub |
| `agent/types.ts` | 0% | Tipos del agente, stub |
| `config/index.ts` | 0% | Barrel export |

#### 10. `src/agent/executor.ts` — 93.77%, ~5 tests para los goals restantes

#### 11. `src/imap.ts` — 93.6%, ~5 tests para branches de reconexión/error

---

## Mejoras estructurales pendientes

### Refactor menores

| Tarea | Prioridad | Notas |
|-------|-----------|-------|
| Eliminar `tests/organizer.test.ts` (obsoleto, reemplazado por `tests/agent/organizer.test.ts`) | 🟢 | Archivo huérfano |
| Añadir `coverage/` a `.gitignore` si se genera localmente | 🟢 | Ya existe en `.gitignore` del worktree |
| Revisar si `tests/server-tools.test.ts` está duplicando cobertura de `tests/server/*` | 🟡 | 39 tests, 1660ms, posible split |
| Limpiar stubs `calendar.ts` y `agent/types.ts` | 🟢 | Stubs conocidos |

### Funcional

| Tarea | Prioridad | Notas |
|-------|-----------|-------|
| **Calendar MVP**: cliente CalDAV real | 🔴 | Depende de Bridge |
| **Drive OAuth**: integración token automática | 🟡 | Ahora requiere `proton-drive auth login` manual |
| **Pass CLI alternativo**: gopass | 🟡 | `GOPASS_STORE_DIR` |
| **Alert webhook Slack/Discord**: integración | 🟡 | `AlertSystem` tiene webhook sink |
| **E2E para Pass**: tests de integración con password store mock | 🟡 | Temp dir + gpg mock |
| **Dashboard web**: monitorización alertas | 🟢 | Backlog |

---

## Cómo retomar

```bash
# 1. Situarse en el worktree
cd /home/alexendros/projects/agent-protonsuite/.freebuff/worktrees/thmrqm6q6bhp81

# 2. Verificar estado
git status --short
pnpm run typecheck
pnpm run test          # 635 tests, deben pasar todos
pnpm run coverage      # 90.67% statements

# 3. Elegir módulo objetivo
# Prioridad: server.ts (73%) > config.ts (79%) > smtp.ts (40% branches)
# Ver docs/coverage-report.md para lista completa

# 4. Escribir tests
# Patrón establecido: vi.mock + vi.hoisted + beforeEach(vi.clearAllMocks)

# 5. Verificar
pnpm run typecheck
pnpm run test -- tests/<path>/<file>.test.ts --reporter=verbose
pnpm run coverage
```

### Comandos útiles

```bash
pnpm run typecheck                    # TypeScript strict
pnpm run test                         # Todos los tests
pnpm run test -- tests/server.ts.test.ts --reporter=verbose  # Test específico verbose
pnpm run coverage                     # Coverage completo
pnpm run lint                         # ESLint
pnpm run knip                         # Unused deps/exports
pnpm run build                        # Compilación dist/
pnpm run smoke                        # Smoke test stdio
```

---

## Notas técnicas

### Patrón de mock (Vitest)

Todos los tests nuevos siguen este patrón:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  const mockFn = vi.fn()
  return { mockFn }
})

vi.mock('../../src/dependency.js', () => ({
  exportName: hoisted.mockFn,
}))

describe('Module', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('test case', async () => {
    hoisted.mockFn.mockResolvedValue('expected')
    const result = await moduleFunction()
    expect(result).toBe('expected')
  })
})
```

### Archivos de config (src/config/)

Tras el split, cada producto tiene su propio schema + parse en `src/config/<product>.ts`. La fachada `src/config.ts` importa de `src/config/index.ts` (barrel). Si se añade un nuevo producto, crear su schema aquí y registrar en el barrel.

### CI/CD

4 workflows GitHub Actions:
- `ci.yml`: typecheck, test, build, smoke
- `quality.yml`: knip, license-check
- `release.yml`: semantic-release (push a main)
- `integration.yml`: E2E con Greenmail (manual dispatch)

Todos migrados a pnpm. Para añadir un nuevo workflow, copiar el setup de `pnpm/action-setup` + `pnpm install --frozen-lockfile`.

### Módulos al 100% (referencia)

```ts
// 19 módulos con cobertura completa:
addresses.ts, alerts/file.ts, alerts/ntfy.ts, alerts/types.ts,
alerts/webhook.ts, auth.ts, config/bridge.ts, config/calendar.ts,
config/pass.ts, ecosystem/binaries.ts, ecosystem/installer.ts,
goals.ts, index.ts, security.ts, server/agent.ts,
server/calendar.ts, server/types.ts, version.ts, which.ts
```

---

## Módulos con cobertura <85% (orden ascendente)

| # | Módulo | Stmts | Branch | Funcs | Esfuerzo |
|---|--------|-------|--------|-------|----------|
| 1 | `server.ts` | **73.64%** | 64.7% | 80% | ~30 tests |
| 2 | `config.ts` | **79.23%** | 86.95% | 73.68% | ~15 tests |
| 3 | `smtp.ts` | **79.8%** | **40.9%** | 76.92% | ~15 tests |
| 4 | `bridge/bridge-client.ts` | **80%** | 75.28% | 94.73% | ~15 tests |
| 5 | `http.ts` | **81.65%** | 90.62% | 83.33% | ~5 tests |
| 6 | `config/drive.ts` | **82.14%** | 66.66% | 100% | ~5 tests |
| 7 | `alerts/index.ts` | **76%** | 61.53% | 77.77% | ~10 tests |

**Estimación:** completando los 7 módulos → ~93-94% statements global.

---

## Glosario de dependencias clave

| Paquete | Uso |
|---------|-----|
| `@modelcontextprotocol/sdk@^1.29` | MCP server + StreamableHTTP transport |
| `express@^5.2.1` | HTTP server |
| `imapflow@^1.4.3` | IMAP client para Bridge |
| `nodemailer@^9.0.3` | SMTP client |
| `zod@^4.3.6` | Schema validation |
| `mailparser@^3.9.12` | Parsing de email MIME |
| `vitest@^3.0.0` | Test runner |
| `supertest@^7.2.2` | HTTP test helpers |
