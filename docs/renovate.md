# Renovate — matriz de decisiones

### Propósito de este documento
- **Objetivos:** Documentar la política de actualizaciones y el automerge condicionado a CI verde.
- **Estructura:** Archivo canónico → matriz por tipo de dependencia → notas de merge.
- **Contenido a integrar según contexto:** Europe/Madrid, label `dependencies`, majors sin automerge, excepción MCP SDK.

Configuración: [`.github/renovate.json`](../.github/renovate.json).

Reemplaza a Dependabot **version-updates** (las GitHub Dependabot Alerts se conservan).
Base: presets org `infraestructura-stack` + overrides explícitos.

| Regla | ¿Qué cubre? | update-type | Auto-merge | Label extra | Razonamiento |
|-------|-------------|-------------|-----------|-------------|--------------|
| [1] npm patch+minor | `dependencies` + `devDependencies` | minor/patch agrupados | **sí** (CI verde) | `dependencies` | Canon P1; `automergeType: pr`. |
| [2] MCP SDK | `@modelcontextprotocol/sdk` | todo | nunca | `mcp` | Núcleo del protocolo; apretado a `server.json`/`mcpName`/transports (ADR-002). |
| [3] Majors | todo | major | nunca | `breaking-change` | Siempre revisión manual; se abre fuera de schedule. |
| [4] GitHub Actions | `github-actions` | digest | nunca | — | Supply-chain; SHAs ya pinneados (zizmor). |
| [5] Docker base | `docker` (node) | digest | nunca | — | Pin a digest para inmutabilidad (SLSA). |
| vuln alerts | advisories | fix | nunca | `security` | Inmediato (`before 10am` weekdays), `lowest` fix = cambio mínimo. |
| lockfile maint | pnpm-lock.yaml | — | nunca | — | Weekly; consolida todos los updates. |

**Nota sobre `automerge`:** solo con CI verde (`quality`, `test`, `smoke`, `build`). El preset org ya incluye defaults; las reglas arriba son overrides de este repo. No hay Dependabot version-updates.
