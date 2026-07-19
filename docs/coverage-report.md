# Coverage Report

**Generado:** 2026-07-19 — vitest + @vitest/coverage-v8 (Ronda 3b: server/drive.ts + http.ts)

## Resumen global

| Métrica | Valor | Diferencia vs anterior |
|---------|-------|----------------------|
| **Statements** | **93.72%** | +1.04pp |
| Branches | 89.5% | +1.09pp |
| **Functions** | **94.37%** | — |
| Lines | 93.72% | +1.04pp |
| Tests | 745 / 42 files | +53 tests / +1 file |

## Todos los módulos ordenados por cobertura (ascendente)

| # | Módulo | Stmts | Branch | Funcs | Prioridad |
|---|--------|-------|--------|-------|-----------|
| 1 | `src/agent/types.ts` | **0%** | 0% | 0% | 🟡 stub |
| 2 | `src/agent-cli.ts` | **0%** | 100% | 100% | 🟡 CLI entry |
| 3 | `src/calendar-types.ts` | **0%** | 0% | 0% | 🟡 stub |
| 4 | `src/calendar.ts` | **0%** | 100% | 100% | 🟡 stub |
| 5 | `src/config/index.ts` | **0%** | 100% | 100% | 🟡 barrel |
| 6 | `src/bridge/bridge-client.ts` | **80%** | 75.28% | 94.73% | 🔴 |
| 7 | `src/http.ts` | **81.65%** | 90.62% | 83.33% | 🟢 |
| 8 | `src/config/drive.ts` | **82.14%** | 66.66% | 100% | 🟢 |
| 9 | `src/config.ts` | **79.23%** | 86.95% | 73.68% | 🔴 |
| 10 | `src/ecosystem/discovery.ts` | **93.57%** | 93.54% | 100% | ✅ |
| 11 | `src/imap.ts` | **93.6%** | 91.42% | 84.61% | ✅ |
| 12 | `src/agent/executor.ts` | **93.77%** | 87.23% | 100% | ✅ |
| 13 | `src/diagnostics.ts` | **93.78%** | 82.05% | 87.5% | ✅ |
| 14 | `src/drive-audit.ts` | **94.16%** | 94.11% | 100% | ✅ |
| 15 | `src/drive.ts` | **94.37%** | 90.19% | 100% | ✅ |
| 16 | `src/ecosystem/updater.ts` | **96.42%** | 94.44% | 100% | ✅ |
| 17 | `src/server.ts` | **96.75%** | 81.57% | 80% | 🟢 |
| 18 | `src/ecosystem/installer.ts` | **96.42%** | 93.54% | 100% | ✅ |
| 19 | `src/agent/organizer.ts` | **97.64%** | 82.5% | 100% | ✅ |
| 20 | `src/server/suite.ts` | **98.38%** | 92.3% | 100% | ✅ |
| 21 | `src/smtp.ts` | **98.55%** | 79.1% | 100% | ✅ |
| 22 | `src/alerts/index.ts` | **98.66%** | 100% | 100% | ✅ |
| 23 | `src/pass.ts` | **99.1%** | 88.67% | 100% | ✅ |
| 24 | `src/server/pass.ts` | **99.56%** | 95.23% | 100% | ✅ |
| 25 | `src/server/drive.ts` | **99.49%** | 85.22% | 100% | ✅ |
| 26 | `src/addresses.ts` | **100%** | 89.65% | 100% | ✅ |
| 27 | `src/alerts/file.ts` | **100%** | 100% | 100% | ✅ |
| 28 | `src/alerts/ntfy.ts` | **100%** | 100% | 100% | ✅ |
| 29 | `src/alerts/rules.ts` | **100%** | 97.29% | 100% | ✅ |
| 30 | `src/alerts/types.ts` | **100%** | 100% | 100% | ✅ |
| 31 | `src/alerts/webhook.ts` | **100%** | 100% | 100% | ✅ |
| 32 | `src/auth.ts` | **100%** | 100% | 100% | ✅ |
| 33 | `src/config/bridge.ts` | **100%** | 92.3% | 100% | ✅ |
| 34 | `src/config/calendar.ts` | **100%** | 100% | 100% | ✅ |
| 35 | `src/config/pass.ts` | **100%** | 100% | 100% | ✅ |
| 36 | `src/ecosystem/binaries.ts` | **100%** | 100% | 100% | ✅ |
| 37 | `src/goals.ts` | **100%** | 100% | 100% | ✅ |
| 38 | `src/index.ts` | **100%** | 100% | 100% | ✅ |
| 39 | `src/setup.ts` | **100%** | 90% | 100% | ✅ |
| 40 | `src/security.ts` | **100%** | 100% | 100% | ✅ |
| 41 | `src/server/agent.ts` | **100%** | 100% | 100% | ✅ |
| 42 | `src/server/calendar.ts` | **100%** | 100% | 100% | ✅ |
| 43 | `src/server/ecosystem.ts` | **100%** | 94.59% | 100% | ✅ |
| 44 | `src/server/mail.ts` | **100%** | 95.94% | 100% | ✅ |
| 45 | `src/server/types.ts` | **100%** | 100% | 100% | ✅ |
| 46 | `src/server/utils.ts` | **100%** | 100% | 100% | ✅ |
| 47 | `src/version.ts` | **100%** | 100% | 100% | ✅ |
| 48 | `src/which.ts` | **100%** | 100% | 100% | ✅ |

**Leyenda:** 🔴 <70% | 🟡 70-85% | 🟢 85-99% | ✅ 100%

## Por grupo

### `src/` — 88.08% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| agent-cli.ts | 0% | 100% | 100% | 0% |
| calendar-types.ts | 0% | 0% | 0% | 0% |
| calendar.ts | 0% | 100% | 100% | 0% |
| config.ts | 79.23% | 86.95% | 73.68% | 79.23% |
| server.ts | 96.75% | 81.57% | 80% | 96.75% |
| smtp.ts | 98.55% | 79.1% | 100% | 98.55% |
| **http.ts** | **81.65%** | **90.62%** | **83.33%** | **81.65%** |
| imap.ts | 93.6% | 91.42% | 84.61% | 93.6% |
| diagnostics.ts | 93.78% | 82.05% | 87.5% | 93.78% |
| drive.ts | 94.37% | 90.19% | 100% | 94.37% |
| drive-audit.ts | 94.16% | 94.11% | 100% | 94.16% |
| pass.ts | 99.1% | 88.67% | 100% | 99.1% |
| addresses.ts | 100% | 89.65% | 100% | 100% |
| auth.ts | 100% | 100% | 100% | 100% |
| security.ts | 100% | 100% | 100% | 100% |
| version.ts | 100% | 100% | 100% | 100% |
| which.ts | 100% | 100% | 100% | 100% |

### `src/agent/` — 96.67% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| types.ts | 0% | 0% | 0% | 0% |
| executor.ts | 93.77% | 87.23% | 100% | 93.77% |
| organizer.ts | 97.64% | 82.5% | 100% | ✅ |
| goals.ts | 100% | 100% | 100% | 100% |
| index.ts | 100% | 100% | 100% | 100% |
| setup.ts | 100% | 90% | 100% | 100% |

### `src/alerts/` — 99.71% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| index.ts | 98.66% | 100% | 100% | ✅ |
| rules.ts | 100% | 97.29% | 100% | ✅ |
| file.ts | 100% | 100% | 100% | 100% |
| ntfy.ts | 100% | 100% | 100% | 100% |
| types.ts | 100% | 100% | 100% | 100% |
| webhook.ts | 100% | 100% | 100% | 100% |

### `src/bridge/` — 80% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| bridge-client.ts | 80% | 75.28% | 94.73% | 80% |

### `src/config/` — 92.77% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| index.ts | 0% | 100% | 100% | 0% |
| drive.ts | 82.14% | 66.66% | 100% | 82.14% |
| bridge.ts | 100% | 92.3% | 100% | 100% |
| calendar.ts | 100% | 100% | 100% | 100% |
| pass.ts | 100% | 100% | 100% | 100% |

### `src/ecosystem/` — 97.18% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| discovery.ts | 93.57% | 93.54% | 100% | 93.57% |
| updater.ts | 96.42% | 94.44% | 100% | 96.42% |
| binaries.ts | 100% | 100% | 100% | 100% |
| installer.ts | 100% | 93.54% | 100% | 100% |

### `src/server/` — 99.71% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| **drive.ts** | **99.49%** | **85.22%** | **100%** | ✅ |
| pass.ts | 99.56% | 95.23% | 100% | 99.56% |
| suite.ts | 98.38% | 92.3% | 100% | 98.38% |
| agent.ts | **100%** | 100% | 100% | ✅ |
| calendar.ts | 100% | 100% | 100% | 100% |
| ecosystem.ts | 100% | 94.59% | 100% | 100% |
| mail.ts | 100% | 95.94% | 100% | 100% |
| types.ts | 100% | 100% | 100% | 100% |
| utils.ts | 100% | 100% | 100% | 100% |

## Progreso

| Fecha | Statements | Tests | Archivos | Hitos |
|-------|-----------|-------|----------|-------|
| **Jul 2026 (Ronda 3b)** | **93.72%** | **745** | **42** | server/drive.ts 89%→99% (+43 tests), http.ts branches 86%→90% (+10 tests) |
| Jul 2026 (Ronda 2) | 90.65% → **92.68%** | 619 → **692** | 38 → **41** | server.ts 73%→96%, smtp.ts 79%→98% (branches 40%→79%), alerts/index.ts 76%→98% |
| Jul 2026 (post-merge) | 90.65% | 619 | 38 | Repo renombrado, PRs #65 y #66 fusionados |
| Jul 2026 (previo) | 90.67% | 640 | 42 | server/agent 64%→100%, organizer 68%→98%, http 69%→81%, rules 71%→100% |
| Jun 2026 (base) | 61.7% | 258 | 21 | Reporte inicial |

## Top 3 prioridad de cobertura

| # | Módulo | Stmts | Branches | Esfuerzo estimado | Impacto |
|---|--------|-------|----------|-------------------|---------|
| 1 | `src/bridge/bridge-client.ts` | **80%** | 75.28% | ~15 tests (MCP bridge client) | +1.0pp |
| 2 | `src/config.ts` | **79.23%** | 86.95% | ~15 tests (loadConfig, env, file, merge) | +1.5pp |
| 3 | `src/config/drive.ts` | **82.14%** | 66.66% | ~5 tests (drive config parsing) | +0.3pp |
