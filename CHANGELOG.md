# Changelog

All notable changes to `@alexendros/protonmail-mcp` (renamed back from `@alexendros/proton-mail-mcp` at v0.2.0) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **Reason for rename U-turn.** The intermediate name `proton-mail-mcp` (kebab-case) introduced in `0.1.0` was chosen for "brand alignment" but read awkwardly (`proton-mail` reads as two separate words while Proton's product is `Proton Mail` — a brand, not a compound). The single-word `protonmail-mcp` matches Proton AG's own `protonmail.com` heritage domain and aligns with the upstream community Docker image `shenxn/protonmail-bridge`. After two months of operational use the kebab form was found to introduce friction in autocomplete and verbal communication. This is the **last** rename — version `0.2.x` series locks the identity.
- Old package `@alexendros/proton-mail-mcp@0.1.x` deprecated with pointer to the new name. Old deprecation on the original `@alexendros/protonmail-mcp@<pre-0.1.0>` cleared (`npm deprecate '@alexendros/protonmail-mcp' ''`).
- No functional changes; this is a metadata-only release.

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
- HTTP transport (`/mcp` over Bearer token at `protonmail.alexendros.me`) is intentionally **not** declared in `server.json` `remotes[]` because the registry policy requires remote endpoints to be publicly accessible without authentication. Operator decides when (and whether) to expose an unauthenticated public HTTP endpoint.
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

[0.2.0]: https://github.com/Iniciativas-Alexendros/protonmail-mcp/releases/tag/v0.2.0
[0.1.2]: https://github.com/Iniciativas-Alexendros/protonmail-mcp/releases/tag/v0.1.2
[0.1.1]: https://github.com/Iniciativas-Alexendros/protonmail-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/Iniciativas-Alexendros/protonmail-mcp/releases/tag/v0.1.0
