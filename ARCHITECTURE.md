# Arquitectura de protonmail-mcp

Documento dedicado de arquitectura. El `README.md` da la visión orientada
a uso; aquí se consolida el modelo interno, los flujos y las fronteras de
seguridad. Las decisiones de fondo se registran en `docs/adr/`.

## 1. Propósito y encaje

`protonmail-mcp` es un servidor **MCP (Model Context Protocol)** que expone
una cuenta Proton Mail — lectura, búsqueda, envío, mover, etiquetar,
borrar — a cualquier cliente MCP, hablando IMAP/SMTP contra **Proton Mail
Bridge**. Proton no ofrece API pública y su correo es E2E; Bridge resuelve
ambos puntos exponiendo IMAP/SMTP locales tras realizar la criptografía en
una máquina que controla el operador.

## 2. Capas

```
Consumidores MCP            stdio: Claude Code CLI (local)
                            HTTP : Claude Routines / backend propio
        │ JSON-RPC                │ HTTPS + Bearer + Origin allowlist
        ▼                         ▼
protonmail-mcp (TypeScript · @modelcontextprotocol/sdk@^1.19)
   config.ts · auth.ts · http.ts · server.ts · imap.ts · smtp.ts
        │ IMAP 1143 STARTTLS      │ SMTP 1025 STARTTLS
        ▼                         ▼
Proton Mail Bridge  ── FRONTERA CRIPTOGRÁFICA E2E ──
        │ OpenPGP + HTTPS
        ▼
Servidores Proton (cifrado E2E)
```

- **Consumidores MCP**: clientes que hablan JSON-RPC vía `stdio` (local) o
  `streamable HTTP` (remoto, con Bearer + allowlist de origen).
- **protonmail-mcp**: este servidor. Doble transporte, validación Zod,
  pools persistentes a Bridge.
- **Proton Mail Bridge**: corre en host/red controlados por el operador.
  Es la frontera criptográfica: todo lo que queda a su izquierda opera
  sobre correo en claro; nada se filtra a terceros.
- **Servidores Proton**: almacenan el correo cifrado E2E.

## 3. Módulos (`src/`)

| Módulo | Responsabilidad |
|---|---|
| `index.ts` | Arranque: elige stdio o HTTP, signal handlers, guardrails de producción |
| `config.ts` | Validación de env con Zod + logger a stderr |
| `auth.ts` | `compareTokens` timing-safe + `extractBearer` |
| `http.ts` | `buildHttpApp`: Express con per-session StreamableHTTP, rate-limit, origin allowlist |
| `imap.ts` | `ImapClient`: pool imapflow + retry/backoff + mailbox locks |
| `smtp.ts` | `SmtpClient`: pool nodemailer + helpers de threading (reply/forward) |
| `server.ts` | `McpServer` con registro de las 13 tools (Zod in, markdown/json out) |

### Claves de diseño

- **Frontera cripto**: la garantía E2E de Proton se preserva porque el
  descifrado ocurre en Bridge, en una máquina del operador. Ni Anthropic ni
  terceros ven correo descifrado; sólo el agente autorizado.
- **Per-session HTTP transport**: un `StreamableHTTPServerTransport` por
  `Mcp-Session-Id` (recomendación del SDK), evitando bleed de estado entre
  clientes concurrentes; eviction tras 30 min idle.
- **Pools persistentes IMAP/SMTP**: una conexión a Bridge reutilizada entre
  llamadas, con reconexión por retry + backoff exponencial si Bridge se
  reinicia.
- **Stderr-only logs**: en modo `stdio`, `stdout` queda reservado al
  JSON-RPC; contaminarlo rompería el protocolo. Ningún cuerpo de request ni
  credencial se registra.

## 4. Las 13 tools

Las tools de lectura aceptan `response_format: "markdown" | "json"`. Cada
una se registra con `annotations` del SDK (`readOnlyHint`,
`idempotentHint`, `destructiveHint`, `openWorldHint`) para que el modelo
razone sobre el efecto antes de invocar.

| Tool | Tipo | Descripción |
|---|---|---|
| `proton_list_folders` | read | Lista mailboxes (INBOX, Sent, Trash, labels, custom) |
| `proton_create_folder` | write | Crea un mailbox nuevo |
| `proton_mailbox_status` | read | Contadores: total / unseen / recent |
| `proton_list_emails` | read | Lista paginada de mensajes recientes |
| `proton_search_emails` | read | Búsqueda con filtros combinables |
| `proton_get_email` | read | Mensaje completo: headers, cuerpo, metadata de adjuntos |
| `proton_get_attachment` | read | Adjunto en base64; `max_bytes` 10 MB (cap 50 MB), `truncated` explícito |
| `proton_send_email` | write | Envía texto/HTML + adjuntos; `from` fijo (no spoofing) |
| `proton_reply_email` | write | Responde preservando threading (`In-Reply-To` + `References`) |
| `proton_forward_email` | write | Reenvía opcionalmente con adjuntos originales |
| `proton_flag_email` | write (idempotente) | read/unread/starred/unstarred/flags custom |
| `proton_move_email` | write | Mueve entre mailboxes por UID |
| `proton_delete_email` | **destructiva** | `trash` (reversible) o `permanent` (expunge) |

### Flujo de una llamada

1. El cliente abre transporte (`stdio` o `POST /mcp` con Bearer).
2. En HTTP: `auth.ts` valida el Bearer timing-safe, se comprueba el Origin
   contra la allowlist y el rate-limit por token.
3. `server.ts` deserializa los argumentos y los valida con el schema Zod de
   la tool.
4. La tool delega en `ImapClient` (`imap.ts`) o `SmtpClient` (`smtp.ts`),
   reutilizando el pool a Bridge.
5. Bridge resuelve sobre el vault cifrado y devuelve correo en claro al MCP.
6. La respuesta se serializa según `response_format` y vuelve por el
   transporte; los logs van a stderr.

## 5. Despliegue (Docker)

Dos contenedores en `docker-compose.yml`:

- **bridge**: Proton Mail Bridge headless. Imagen `Dockerfile.bridge`
  (extiende `shenxn/protonmail-bridge:build` con libfido2, dbus-x11,
  credential-helpers, libGL/libOpenGL y libs Qt XCB). Requiere un login
  one-off interactivo; el volumen persiste el vault.
- **mcp**: este servidor en modo HTTP. Imagen `Dockerfile` (multi-stage
  `node:20-alpine`).

Red `proton-net` interna entre ambos; `dokploy-network` externa para que
Traefik emita el cert Let's Encrypt y exponga `/mcp`. En
`NODE_ENV=production` el servidor se niega a arrancar si
`MCP_ALLOWED_ORIGINS` está vacío.

## 6. No-objetivos

- No reimplementa criptografía Proton: delega toda la E2E en Bridge.
- No expone un endpoint HTTP público sin autenticación (por eso `remotes[]`
  de `server.json` queda vacío).
- No permite spoofing del remitente: `from` queda fijo al configurado.
- No es un boilerplate genérico de correo; es un cliente específico de
  Proton vía Bridge.

## 7. Seguridad — modelo de amenazas (T1–T7)

Detalle completo y controles en `SECURITY.md`. Resumen:

| Id | Amenaza | Mitigación principal |
|----|---------|----------------------|
| T1 | Robo del bearer MCP | Rotación `openssl rand -hex 32` + rate-limit 120/min/token |
| T2 | DNS rebinding | `MCP_ALLOWED_ORIGINS` exigido en producción |
| T3 | Abuso de relay SMTP | Rate-limit + límite diario de Bridge + `from` fijo |
| T4 | Prompt injection vía cuerpo de email | Tratar cuerpos como no confiables; HITL en tools destructivas |
| T5 | Robo de credenciales IMAP del entorno | Secretos solo en Dokploy / `.env` 0600; rotación vía Bridge |
| T6 | Exfiltración vía adjuntos en contexto LLM | Cap `max_bytes` (10 MB, hard 50 MB) + revisión del operador |
| T7 | Downgrade TLS del canal Bridge local | Bridge en `127.0.0.1` / red interna; `PROTON_BRIDGE_CA_PATH` para pinning |

La E2E de Proton se detiene en la frontera de Bridge: todo aguas abajo (este
MCP, Claude, Routines) opera sobre texto en claro por diseño.

## 8. Stack

TypeScript 5.7 (`strict`, `NodeNext`) · Node ≥20 ·
`@modelcontextprotocol/sdk@^1.19` · `imapflow` · `nodemailer` ·
`mailparser` · `zod` · `express` + `express-rate-limit` · Vitest +
`supertest`. CI: matrix Node 20/22 (typecheck, test, build, smoke),
`npm audit`, CodeQL, docker build; release a GHCR en push a `main`.
