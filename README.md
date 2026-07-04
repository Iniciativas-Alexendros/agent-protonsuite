# Proton Mail Agent

[![npm version](https://img.shields.io/npm/v/@alexendros/protonmail-agent.svg)](https://www.npmjs.com/package/@alexendros/protonmail-agent)
[![CI](https://github.com/Iniciativas-Alexendros/agent-protonmail/actions/workflows/ci.yml/badge.svg)](https://github.com/Iniciativas-Alexendros/agent-protonmail/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Iniciativas-Alexendros/agent-protonmail/actions/workflows/codeql.yml/badge.svg)](https://github.com/Iniciativas-Alexendros/agent-protonmail/actions/workflows/codeql.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](./package.json)
[![MCP SDK](https://img.shields.io/badge/%40modelcontextprotocol%2Fsdk-%5E1.29-blue.svg)](https://github.com/modelcontextprotocol/typescript-sdk)

Agente de correo para **Proton Mail** vía Proton Mail Bridge. Incluye un **MCP server** embebido y una capa de agente autónomo con dos funciones principales:

1. **Operar el buzón** como servidor MCP — lectura, búsqueda, envío, mover, etiquetar, borrar — compatible con cualquier cliente MCP.
2. **Configurar, organizar y vigilar** el buzón de forma inteligente — auto-detección de Bridge, clasificación profesional de correos, propuesta de carpetas/etiquetas, alertas de spam/fraude y archivado.

- **Modo primario:** `stdio` local, sin exponer nada a la red.
- **Modo avanzado:** `streamable HTTP` con bearer auth + origin allowlist.
- **Privacidad:** Bridge descifra el correo en tu máquina; el agente nunca ve tu contraseña Proton.
- **Licencia:** AGPL-3.0 — software libre con copyleft de red.

---

## Quickstart — 5 minutos

Prerrequisitos: **Node ≥ 22** y **Proton Mail Bridge** corriendo en local (`protonmail-bridge-core --cli` → `login` → `info` para copiar el bridge password).

### 1. Instalar

```bash
npx -y @alexendros/protonmail-agent setup
# o, si prefieres el MCP server directamente:
npx -y @alexendros/protonmail-agent protonmail-mcp
```

> El binario `protonmail-agent` ejecuta el agente; `protonmail-mcp` ejecuta el MCP server.

### 2. Verificar conexión

```bash
export PROTON_BRIDGE_USER=you@proton.me
export PROTON_BRIDGE_PASS=your-bridge-password
export PROTON_MAIL_FROM=you@proton.me
npx -y @alexendros/protonmail-agent setup
```

Si Bridge responde, el agente reporta carpetas y recomienda el siguiente paso.

### 3. Configurar tu cliente MCP

Añade este bloque a tu cliente MCP (formato genérico `mcpServers`):

```jsonc
{
  "mcpServers": {
    "protonmail": {
      "command": "npx",
      "args": ["-y", "@alexendros/protonmail-agent", "protonmail-mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "PROTON_BRIDGE_USER": "you@proton.me",
        "PROTON_BRIDGE_PASS": "your-bridge-password",
        "PROTON_MAIL_FROM": "you@proton.me",
        "PROTON_BRIDGE_TLS_INSECURE": "true"
      }
    }
  }
}
```

> **Seguridad:** no dejes el bridge password en claro en el disco. Usa un wrapper que lo resuelva just-in-time desde tu gestor de secretos. Plantilla en [`connectors/stdio-wrapper.sh.example`](./connectors/stdio-wrapper.sh.example).

### 4. Organizar el buzón

```bash
npx -y @alexendros/protonmail-agent organize
```

En modo `AGENT_DRY_RUN=true` (default), el agente analiza el buzón y presenta un plan de carpetas, etiquetas y alertas sin aplicar cambios. Cuando hayas validado el plan, desactiva `AGENT_DRY_RUN` para ejecutar.

---

## Documentación

| Documento | Para quién | Qué cubre |
|---|---|---|
| [`docs/human-quickstart.md`](./docs/human-quickstart.md) | Usuarios no técnicos | Instalación paso a paso, Bridge, primer uso, modo agente. |
| [`docs/agent-quickstart.md`](./docs/agent-quickstart.md) | Agentes IA / desarrolladores | Cómo consumir las 14 tools, formatos de respuesta, ejemplos. |
| [`docs/bridge-core.md`](./docs/bridge-core.md) | Todos | `protonmail-bridge-core` headless, puertos, vault, troubleshooting. |
| [`docs/local-stdio-secrets.md`](./docs/local-stdio-secrets.md) | Operadores | Wrapper stdio que no deja secretos en disco. |
| [`docs/deployment-http-docker.md`](./docs/deployment-http-docker.md) | DevOps | Despliegue HTTP con Docker, auth, allowlist, healthcheck. |
| [`docs/alerting.md`](./docs/alerting.md) | Operadores | Configuración de alertas de contenido, webhook, logs. |
| [`docs/knowledge-base.md`](./docs/knowledge-base.md) | Todos | Convenciones de clasificación y categorías profesionales. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Desarrolladores | Capas internas, modelo de amenazas, decisiones. |
| [`SECURITY.md`](./SECURITY.md) | Desarrolladores / auditores | Controles activos y threat model para agentes IA. |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contribuidores | Convenciones, PRs, tests, licencia AGPL-3.0. |

## Conectores y playbooks

- [`connectors/stdio-npx.json`](./connectors/stdio-npx.json): config stdio genérica para cualquier cliente MCP.
- [`connectors/stdio-wrapper.sh.example`](./connectors/stdio-wrapper.sh.example): wrapper seguro con resolución JIT de secretos.
- [`connectors/http-curl.sh.example`](./connectors/http-curl.sh.example): handshake HTTP con curl.
- [`playbooks/onboarding.md`](./playbooks/onboarding.md): pipeline de objetivos para puesta en marcha.
- [`playbooks/organize-inbox.md`](./playbooks/organize-inbox.md): organizar y archivar correos.
- [`playbooks/triage-email.md`](./playbooks/triage-email.md): workflow de triaje (dry-run obligatorio, nunca borra).
- [`playbooks/reply-organize.md`](./playbooks/reply-organize.md): responder y organizar correos.
- [`playbooks/fraud-detection.md`](./playbooks/fraud-detection.md): revisión de correos sospechosos.
- [`playbooks/setup-checklist.md`](./playbooks/setup-checklist.md): checklist de puesta en marcha.

---

## Las 14 tools MCP

Todas las tools de lectura aceptan `response_format: "markdown" | "json"`. La tool adicional del agente (`proton_agent_plan`) expone el plan de organización/alertas para consumo por clientes MCP.

| Tool | Tipo | Descripción |
|---|---|---|
| `proton_list_folders` | read | Lista mailboxes (INBOX, Sent, Trash, labels, custom). |
| `proton_create_folder` | write | Crea un mailbox nuevo. |
| `proton_mailbox_status` | read | Contadores: total / unseen / recent. |
| `proton_list_emails` | read | Lista paginada de mensajes recientes. |
| `proton_search_emails` | read | Búsqueda con filtros combinables. |
| `proton_get_email` | read | Mensaje completo: headers, cuerpo, adjuntos. |
| `proton_get_attachment` | read | Adjunto en base64; `max_bytes` 10 MB default (cap 50 MB). |
| `proton_send_email` | write | Envía texto/HTML + adjuntos. |
| `proton_reply_email` | write | Responde preservando threading. |
| `proton_forward_email` | write | Reenvía con adjuntos opcionales. |
| `proton_flag_email` | write idempotent | read/unread/starred/unstarred/custom. |
| `proton_move_email` | write | Mueve entre mailboxes por UID. |
| `proton_delete_email` | destructive | `trash` (default) o `permanent`. |
| `proton_agent_plan` | read | Devuelve el plan de organización/alertas del agente en formato JSON. |

---

## Calidad y seguridad

```bash
npm run typecheck
npm test
npm run build
npm run smoke
npm run license-check
npm run license-check:prod
```

- TypeScript strict, tests con Vitest, smoke `stdio` en CI.
- Bearer timing-safe, origin allowlist, rate-limit 120/min/token.
- Per-session HTTP transport, sesiones idle evicted a los 30 min.
- Sin credenciales ni cuerpos de request en logs; stdout reservado a JSON-RPC en modo `stdio`.
- Alertas de contenido con webhook + salida estructurada a fichero.
- Modo dry-run por defecto en el agente hasta validación del operador.

---

## Licencia

[AGPL-3.0](./LICENSE) — Copyright 2026 Alejandro Domingo Agustí (Alexendros). Sin afiliación a Proton AG.

Para la lista de dependencias y compatibilidad de licencias, véase [`NOTICE.md`](./NOTICE.md).
