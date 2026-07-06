# CLAUDE.md — plugin-protonmail-claudecode

<proyecto>
Servidor MCP para Proton Mail vía Proton Mail Bridge (IMAP/SMTP local). Expone la bandeja
(leer, buscar, enviar, responder, reenviar, mover, etiquetar, borrar) a clientes MCP con tipado
estricto y doble transporte: `stdio` (modo de referencia, Claude Code/OpenCode local, on-demand)
y `streamable HTTP` con bearer + allowlist de origen (modo avanzado, remoto/Docker).

El repo es a la vez el servidor (npm `@alexendros/protonmail-mcp`, mcpName
`io.github.Alexendros/protonmail-mcp`, nombre runtime `protonmail-mcp`) y un plugin instalable de
Claude Code (`plugins/protonmail-mcp/` + `.claude-plugin/marketplace.json`) con la skill
`triaje-correo`. `proton-mail-mcp` (con guion) es el nombre histórico pre-v0.2.0; no usar.
</proyecto>

<stack>
TypeScript ESM (`"type":"module"`), Node >=20. MCP `@modelcontextprotocol/sdk` ^1.19 · HTTP
`express` ^5 + `express-rate-limit` · correo `imapflow` + `mailparser` + `nodemailer` ^9 · validación
`zod` ^4. Build `tsc`; tests `vitest`; calidad por `typecheck` (tsc strict) + tests (sin lint dedicado).
Empaquetado: `bin` = `dist/index.js`; `files` publica solo `dist`, README, LICENSE (`dist/` gitignored:
para uso local hay que `npm run build`). La versión es ÚNICA y se lee de `package.json` en runtime
(`src/version.ts`); no hardcodear versiones en el código.

Scripts (package.json):
- `npm run build` → `tsc` (genera `dist/`) · `npm start` → `node dist/index.js` · `npm run dev` → `tsc --watch`
- `npm run typecheck` → `tsc --noEmit`
- `npm test` → `vitest run` (unit, todo mockeado; NO incluye los `*.e2e.ts`)
- `npm run test:e2e` → vitest contra GreenMail real (config `vitest.e2e.config.ts`; requiere GreenMail vivo)
- `npm run test:e2e:local` → `scripts/e2e-greenmail.sh` (levanta GreenMail en Docker, corre el E2E, limpia)
- `npm run inspect` → MCP inspector sobre `dist/index.js` · `npm run smoke` → `bash scripts/smoke.sh`
</stack>

<arquitectura>
Entrypoint `src/index.ts`: lee `MCP_TRANSPORT` y arranca rama `stdio` (un McpServer + pools IMAP/SMTP
por proceso) o `http` (Express + StreamableHTTPServerTransport, un McpServer por sesión, pools
compartidos). Guardrails: HTTP exige `MCP_AUTH_TOKEN`; en producción exige `MCP_ALLOWED_ORIGINS`.
SIGINT/SIGTERM/SIGHUP cierran conexiones a Bridge. Exit 2 = config inválida, exit 1 = runtime.

Módulos `src/`:
- `config.ts` — carga+valida env con Zod (fail-closed) y logger a stderr.
- `version.ts` — VERSION leída de `package.json` en runtime (fuente única).
- `auth.ts` — bearer timing-safe + parser de header Authorization.
- `http.ts` — `buildHttpApp`: per-session transport, CORS preflight pre-auth, rate-limit 120/min por
  bearer, allowlist de origen, eviction de sesiones idle (30 min). `/healthz` sin auth.
- `imap.ts` — `ImapClient`: conexión reutilizable con retry+backoff (3 intentos), locks por mailbox,
  UIDs siempre, parse MIME con mailparser, errores de conexión diferenciados (Bridge caído / auth /
  timeout) con causa preservada.
- `smtp.ts` — `SmtpClient` (pool) + helpers de threading RFC 5322 (`buildReplyOptions`/`buildForwardOptions`).
- `addresses.ts` — parsing de direcciones consolidado (compartido por imap.ts y smtp.ts).
- `server.ts` — `buildServer`: registra las 13 tools `proton_*` con inputSchema Zod, structuredContent,
  annotations (readOnly/destructive/idempotent), logging por handler `{ tool, ms }` a stderr.

13 tools `proton_*`: list_folders, create_folder, mailbox_status, list_emails, get_email,
search_emails, get_attachment, send_email, reply_email, forward_email, move_email, flag_email,
delete_email.

Env vars: `PROTON_BRIDGE_USER`/`PASS` (req), `PROTON_MAIL_FROM`, `PROTON_BRIDGE_HOST` (def 127.0.0.1),
`PROTON_BRIDGE_IMAP_PORT` (1143), `PROTON_BRIDGE_SMTP_PORT` (1025), `PROTON_BRIDGE_TLS_INSECURE` (true),
`PROTON_BRIDGE_SMTP_SECURITY` (starttls|implicit|plain), `MCP_TRANSPORT` (stdio|http),
`MCP_HTTP_HOST`/`MCP_HTTP_PORT`/`MCP_AUTH_TOKEN`/`MCP_ALLOWED_ORIGINS`, `LOG_LEVEL`.

Plugin Claude Code (`plugins/protonmail-mcp/`): `plugin.json` (userConfig de Bridge),
`.protonmail-mcp_claude_mcp.json` (MCP stdio vía `npx -y @alexendros/protonmail-mcp`), wrapper stdio
de ejemplo y skill `triaje-correo` (clasifica INBOX, resume y aparta basura comercial a
`Folders/Marketing-Promo`; SIEMPRE dry-run antes de mover; prohibido `proton_delete_email`).
Despliegue: Dockerfile, Dockerfile.bridge, docker-compose(.yml/.coolify.yml), `server.json` (MCP Registry).
CI: `ci.yml` (verify Node 20/22, audit, e2e-GreenMail service-container, docker-build), `quality.yml`,
`codeql.yml`, `release.yml` (GHCR + `publish-npm` por trusted publishing OIDC en tags).
</arquitectura>

<diseño>
Invariantes y decisiones que hay que respetar al tocar el código:
- **stdout en stdio = JSON-RPC**. Todo log va a stderr (logger de `config.ts`). Contaminar stdout rompe MCP.
- **UIDs, nunca sequence numbers** en move/flag/delete: los seq cambian entre sesiones.
- **SMTP por defecto STARTTLS** (`secure:false`+`requireTLS:true`), que es lo que habla Bridge en 1025.
  `PROTON_BRIDGE_SMTP_SECURITY` permite `implicit` (SMTPS) o `plain` (sin TLS, solo servidores de
  confianza tipo GreenMail). IMAP usa STARTTLS-auto (se queda plain si el server no lo anuncia).
- **`proton_delete_email mode=trash`** auto-detecta el buzón `\Trash` (Papelera/Corbeille…); `trash_path`
  es override opcional. `mode=permanent` es irreversible.
- **Adjuntos** con cap de bytes (`max_bytes`, hard cap 50 MB) + flag `truncated` para no saturar contexto.
- **HTTP**: una sesión MCP = un transport = un McpServer; bearer timing-safe; rate-limit por bearer (no IP,
  por el proxy); CORS preflight antes del auth.
- **E2E** se preserva: cifrado/descifrado ocurren en Bridge (máquina del usuario). El servidor solo habla
  IMAP/SMTP locales; no toca claves Proton.
</diseño>

<verificación>
Verde local (2026-06-20, v0.4.0): typecheck OK · `npm test` 125 unit · build (9 .js) · smoke (13 tools) ·
`npm audit --audit-level=high` 0 · `npm run test:e2e:local` 4/4 contra GreenMail · `npm publish --dry-run`
tarball 0.4.0 (12 ficheros). Las tools reales requieren **Proton Bridge corriendo** (127.0.0.1:1143 IMAP /
1025 SMTP) y app-password de Bridge (NO la contraseña de la cuenta). Sin Bridge, fallan con error accionable.
Verificar Bridge: `ss -ltn | grep 1143`. Lanzarlo: `protonmail-bridge-core --cli` (login + 2FA interactivos).
</verificación>

<pendiente>
**Release** (probado y verificado 2026-06-20 con v0.4.0): `release.yml/publish-npm` publica a npm por
**trusted publishing OIDC** (sin `NPM_TOKEN`, provenance auto). El trusted publisher está dado de alta en
npm (paquete → Settings → Trusted Publisher → GitHub Actions: org `Iniciativas-Alexendros`, repo
`plugin-protonmail-claudecode`, workflow `release.yml`, environment vacío). Cortar una versión: bump en los
4 manifiestos (`package.json` propaga sola a server/healthz vía `version.ts`; `server.json`,
`plugins/.../plugin.json`, `CHANGELOG.md` los pide el gate `metadata-coherence`) → merge a `main` →
`git tag vX.Y.Z && git push origin vX.Y.Z`. El job exige que el tag case `package.json`; NO taggear con
versión divergente. Publish manual no-interactivo es imposible (2FA por OTP email).

Roadmap abierto (ROADMAP.md): MCP Registry estable; `proton_watch_inbox` (IDLE + webhook, sin polling) +
multi-alias; hardening (Bridge CA pinning vía `PROTON_BRIDGE_CA_PATH` para cerrar `TLS_INSECURE`,
human-in-the-loop en `delete mode=permanent`, digest pinning de imagen GHCR). Pendiente menor: validación
manual de tools contra Bridge real (login 2FA del operador).
</pendiente>
