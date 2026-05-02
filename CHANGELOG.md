# Changelog

All notable changes to `@alexendros/proton-mail-mcp` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.1]: https://github.com/Alexendros/proton-mail-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/Alexendros/proton-mail-mcp/releases/tag/v0.1.0
