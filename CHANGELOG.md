# Changelog

Changelog generado automáticamente por [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

El formato sigue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y [SemVer 2.0.0](https://semver.org/).

## Histórico pre-semantic-release
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-07-04

### Changed

- **Rebrand a agente de correo.** El paquete pasa a llamarse `@alexendros/protonmail-agent`, el binario principal es `protonmail-agent` y el repositorio se renombra a `Iniciativas-Alexendros/agent-protonmail`. El MCP server sigue disponible como `protonmail-mcp`.
- **Licencia cambiada a AGPL-3.0.** De MIT a GNU Affero General Public License v3.0, con `NOTICE.md` explicando el cambio y la relación con Proton AG.
- **Seguridad ampliada para agentes IA.** `SECURITY.md` incluye ahora un baseline de agentes autónomos (acción no autorizada, hallucinación, goal injection, data retention, alert fatigue) y controles correspondientes.

### Added

- **Módulo de agente** (`src/agent/`) con goals (`discover`, `setup`, `organize`, `monitor`, `alert`), setup, organización y clasificación de correos.
- **Sistema de alertas** (`src/alerts/`) con reglas de contenido local, detección de amenazas (phishing, spam, fraude), salida a fichero estructurado y webhook.
- **Tool MCP `proton_agent_plan`** para consultar el plan de organización/alertas sin aplicar cambios.
- **CLI de agente** (`src/agent-cli.ts`) ejecutable como `npx protonmail-agent <goal>`.
- **Documentación del agente**: `docs/alerting.md`, `docs/knowledge-base.md`, `playbooks/onboarding.md`, `playbooks/organize-inbox.md`, `playbooks/fraud-detection.md`.
- **Tests de alertas** (`tests/alerts.test.ts`) para reglas de clasificación y detección de amenazas.
- **Configuración del agente** (`AGENT_DRY_RUN`, `AGENT_MAX_INSPECT_EMAILS`, `AGENT_MIN_CONFIDENCE`) y de alertas (`ALERT_WEBHOOK_URL`, `ALERT_MIN_SEVERITY`, `ALERT_LOG_DIR`, `ALERTS_ENABLED`) en `src/config.ts` y `.env.example`.

### Removed

- **Nombre anterior** `@alexendros/protonmail-mcp` queda como alias histórico; el paquete se publica a partir de ahora como `@alexendros/protonmail-agent`.

## [0.4.0] - 2026-06-20

### Fixed

- **Version single-source.** The server version was hardcoded in three places that had drifted (`package.json` 0.3.1, `src/server.ts` "0.3.0", `src/http.ts` `/healthz` "0.2.0"). It is now derived once from `package.json` at runtime via `src/version.ts`.

## [0.4.0] - 2026-06-20

### Fixed

- **Version single-source.** The server version was hardcoded in three places that had drifted (`package.json` 0.3.1, `src/server.ts` "0.3.0", `src/http.ts` `/healthz` "0.2.0"). It is now derived once from `package.json` at runtime via `src/version.ts`.
- **Trash auto-detection in `proton_delete_email`.** `mode=trash` now resolves the mailbox flagged `\Trash` instead of assuming the literal English "Trash", so it works on accounts whose trash is `Papelera`/`Corbeille`/etc. `trash_path` is now an optional override.
- **ISO date validation in `proton_search_emails`.** `since`/`before` are validated as parseable dates (Zod refine) — a malformed date returns a clear schema error instead of a cryptic IMAP failure.
- **Actionable IMAP connection errors.** Connection failures are now classified (Bridge not running / bad credentials / timeout) with a remediation hint, preserving the original error as `cause`.

### Added

- **`PROTON_BRIDGE_SMTP_SECURITY`** env (`starttls` default | `implicit` | `plain`). The default preserves Bridge's STARTTLS behavior; the other modes broaden SMTP compatibility (and enable the GreenMail E2E suite).
- **Real E2E test suite (`npm run test:e2e`)** against GreenMail (IMAP/SMTP) exercising the full send → read → flag → move → delete cycle through the real clients — no mocks. Runs in CI as a service container; `scripts/e2e-greenmail.sh` runs it locally.
- **Generic MCP client docs.** README now documents a standard `mcpServers` config block so non-Claude clients (OpenCode, custom SDK backends) can consume the server directly.
- **`npm publish` in CI.** The release workflow now publishes the npm package (with provenance) on tags, in addition to the GHCR image.

### Changed

- **Per-handler debug logging** (`{ tool, ms }`, no payloads) and consolidated address parsing into `src/addresses.ts` (deduplicated between `imap.ts` and `smtp.ts`).

## [0.2.0] · 2026-05-18

### Changed

- **BREAKING (name only).** Package renamed back to `@alexendros/protonmail-mcp` (single-word `protonmail`, matching Proton AG's own marketing convention). The intermediate name `@alexendros/proton-mail-mcp` (kebab-case form used since `0.1.0`) is now deprecated on npm.
- GitHub repository renamed from `Iniciativas-Alexendros/proton-mail-mcp` → `Iniciativas-Alexendros/protonmail-mcp`. GitHub provides automatic redirect for the old URL; existing clones continue to fetch from `origin`.
- Docker image renamed from `ghcr.io/alexendros/proton-mail-mcp` → `ghcr.io/iniciativas-alexendros/protonmail-mcp` (track GitHub repository casing, which lowercases for GHCR).
- MCP server identifier (`tools/list`) renamed from `proton-mail-mcp` → `protonmail-mcp`. Clients that hardcode the server name in routing logic must update.
- Binary in `package.json` renamed from `proton-mail-mcp` → `protonmail-mcp`. Users invoking the CLI by name must update.
- `mcpName` updated to `io.github.Alexendros/protonmail-mcp` (capital `A`, registry canonical).

### Added

- `Marcas comerciales` section in README — explicit disclaimer that this project is unaffiliated with Proton AG.

### Notes

- **Reason for rename U-turn.** The intermediate name `proton-mail-mcp` (kebab-case) introduced in `0.1.0` was chosen for "brand alignment" but read awkwardly (`proton-mail` reads as two separate words while Proton's product is `Proton Mail` — a brand, not a compound). The single-word `protonmail-mcp` matches Proton AG's own `protonmail.com` heritage domain and aligns with the upstream community Docker image `shenxn/protonmail-bridge`. After two months of operational use the kebab form was found to introduce friction in autocomplete and verbal communication.
- Old package `@alexendros/proton-mail-mcp@0.1.x` deprecated with pointer to the new name. Old deprecation on the original `@alexendros/protonmail-mcp@<pre-0.1.0>` cleared (`npm deprecate '@alexendros/protonmail-mcp' ''`).
- No functional changes; this is a metadata-only release.
- > **Nota histórica (2026-07-04):** en `v0.5.0` el proyecto se transformó en agente y se renombró a `@alexendros/protonmail-agent` / `agent-protonmail`. La afirmación de "último rename" queda reflejada como decisión válida para la serie `0.2.x`.

## [0.1.2] · 2026-05-02

### Fixed

- `mcpName` and `server.json` `name` now use canonical GitHub username casing `Alexendros` (capital A) instead of lowercase `alexendros`. The MCP Registry (`registry.modelcontextprotocol.io`) enforces case-sensitive match between authenticated GitHub login and the namespace prefix; publish to lowercase namespace was rejected with `403 Forbidden: You have permission to publish: io.github.Alexendros/*`.

### Notes

- Metadata-only fix; no functional changes vs `0.1.1`.
- `0.1.1` was published to npm with the lowercase mcpName but never made it into the MCP Registry due to the permission mismatch above. Treat `0.1.2` as the first registry-published version.
- Documentation in upstream MCP Registry quickstart shows lowercase example (`io.github.my-username/`), which is misleading: the actual constraint is exact case-match with `gh api user --jq .login`.

## [0.1.1] · 2026-05-02

### Added

- `server.json` manifest for publication to the [MCP Registry](https://registry.modelcontextprotocol.io/) (preview, API frozen at v0.1).
- `mcpName` field in `package.json` (`io.github.alexendros/proton-mail-mcp`) — required for npm-package ownership verification by the MCP Registry.
- `PUBLISH-MCP-REGISTRY.md` operator playbook for `mcp-publisher` CLI flow (init/login/publish).
- Documented 5 environment variables in `server.json` for discoverability: `PROTON_BRIDGE_HOST`, `PROTON_IMAP_PORT`, `PROTON_SMTP_PORT`, `PROTON_USERNAME` (required), `PROTON_PASSWORD` (required, secret).

### Notes

- This release is metadata-only; no functional changes vs `0.1.0`.
- HTTP transport (`/mcp` over Bearer token at the operator's domain) is intentionally **not** declared in `server.json` `remotes[]` because the registry policy requires remote endpoints to be publicly accessible without authentication. Operator decides when (and whether) to expose an unauthenticated public HTTP endpoint.
- Old npm name `@alexendros/protonmail-mcp` remains deprecated since `0.1.0` — do not republish.

## [0.1.0] · 2026-05-01

### Added

- Initial public release on npm under canonical scope `@alexendros/proton-mail-mcp`.
- Full rename from `@alexendros/protonmail-mcp` → `@alexendros/proton-mail-mcp` (kebab-case alignment per Proton brand).
- 13 MCP tools across 4 capability areas: search/list/read/move/flag/delete emails, send mail with attachments, list folders, get attachments.
- Dual transport: stdio (for Claude Desktop / CLI) + streamable HTTP (for claude.ai Routines / SDK).
- Express middleware: rate limiting + CORS + Bearer auth on HTTP transport.
- `outputSchema` and `structuredContent` on all tools (MCP spec 2025-06-18).
- Read-only annotation hint on `proton_get_email`.
- Governance bundle: README badges, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, GitHub issue templates (bug-report.yml, feature-request.yml).
- Dockerfile + docker-compose.yml for self-hosted deployments.
- Smoke test script (`scripts/smoke.sh`).
- Vitest test setup with supertest for HTTP route coverage.

### Deprecated

- `@alexendros/protonmail-mcp` (old npm name) deprecated with `npm deprecate` pointing to the new package.

[Unreleased]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.4.0
[0.2.0]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.2.0
[0.1.2]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.1.2
[0.1.1]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.1.1
[0.1.0]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.1.0
