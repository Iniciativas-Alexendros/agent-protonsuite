# Security policy — ProtonMail Agent

## Supported versions

Only the `main` branch and the latest published artifacts receive security fixes:

- npm package: `@alexendros/protonmail-agent@latest`
- Docker image: `ghcr.io/iniciativas-alexendros/agent-protonmail:latest`

Older versions published under the legacy name `@alexendros/protonmail-mcp` are deprecated and no longer supported.

## Reporting a vulnerability

Email `security@alexendros.me` (PGP key in the website). Do not open public GitHub issues for vulnerabilities. We aim to acknowledge within 7 days and release a fix within 30 days for critical issues.

---

## Threat model

### Server-level threats (MCP transport)

| Id | Threat | Likelihood | Impact | Mitigation |
|----|--------|------------|--------|------------|
| T1 | **MCP bearer token leaked** (logs, env dump, client-side) | Medium | High — full mailbox read/write on behalf of the user | Rotate with `openssl rand -hex 32`, update all consumers; rate limit caps abuse to 120 req/min; audit logs monthly |
| T2 | **DNS rebinding** (local network attacker causes victim's browser to hit `localhost:8787`) | Low | High | `MCP_ALLOWED_ORIGINS` allowlist enforced on every request; in production the server refuses to start without it |
| T3 | **SMTP relay abuse via `proton_send_email`** (leaked token used for spam) | Medium | Medium | Rate limit by token; Proton Bridge enforces its own daily send limit; `from` is fixed to configured address (no spoofing) |
| T4 | **Prompt injection via email body** (hostile email instructs the agent to exfiltrate/destroy) | High (for any mail-reading agent) | High | Treat bodies as untrusted; destructive tools require human confirmation; do not auto-forward or auto-reply based on untrusted body content |
| T5 | **IMAP credential theft from env** | Low | High — direct access to entire mailbox | Credentials only in deployment secrets / local `.env` (0600); never committed; rotated by regenerating Bridge mailbox password |
| T6 | **Attachment contents exfiltrated via LLM context** | Medium | Medium | `max_bytes` cap (default 10 MB, hard cap 50 MB) truncates large attachments; operator must review before forwarding |
| T7 | **Transport downgrade (MITM on local Bridge TLS)** | Low | Medium | Bridge listens on `127.0.0.1` by default; in Docker, stays inside the internal network. For strict setups set `PROTON_BRIDGE_CA_PATH` and `PROTON_BRIDGE_TLS_INSECURE=false` to pin Bridge's CA |

### Agent-level threats (autonomous email operations)

| Id | Threat | Likelihood | Impact | Mitigation |
|----|--------|------------|--------|------------|
| T8 | **Unauthorized autonomous action** (agent deletes, moves or sends without explicit approval) | Medium | High | Human-in-the-loop (HITL) gate for destructive, bulk or first-time actions; dry-run mode by default for organize/setup pipelines |
| T9 | **Hallucination in classification** (agent mislabels legal/banking/administrative emails) | Medium | High | Confidence scoring; suggested actions are presented, not applied, until operator confirms; review logs in `logs/alerts-*.jsonl` |
| T10 | **Goal injection** (malicious email or prompt hijacks the agent's objective pipeline) | Medium | High | Goal pipeline is allowlisted; untrusted content cannot redefine goals; origin and intent logging for every agent decision |
| T11 | **Data retention and audit gaps** (agent decisions are not traceable) | Low | High | All agent actions, classifications and alert triggers are written to structured audit logs; alert dispatcher can mirror to webhook |
| T12 | **Alert fatigue or missed alerts** (webhook misconfigured or noisy rules) | Medium | Medium | Severity levels (`info`, `warning`, `alert`, `critical`); min-severity threshold configurable; fallback to file and stderr |

---

## Security controls present

### MCP server

- **Bearer token auth** on all `/mcp` requests, timing-safe comparison (`src/auth.ts`).
- **Origin allowlist** (`MCP_ALLOWED_ORIGINS`) — production refuses to start without it.
- **Rate limiting** — 120 req/min per token on `/mcp`.
- **Per-session transports** — one `StreamableHTTPServerTransport` per MCP session id, avoiding state bleed between clients.
- **Session idle eviction** — sessions unused for 30 min are closed.
- **Attachment size cap** — default 10 MB, hard cap 50 MB.
- **No secrets in logs** — logger writes to stderr only; request bodies are not logged.
- **Stdout reserved for MCP JSON-RPC** in stdio mode — logs go to stderr to avoid corrupting the protocol stream.

### Agent

- **Human-in-the-loop** — destructive, bulk or first-time actions require explicit confirmation in the agent pipeline.
- **Dry-run by default** — `agent:organize` and `agent:setup` present their plan before applying changes.
- **Structured audit log** — every agent decision, classification and alert trigger is written to `logs/audit-YYYY-MM-DD.jsonl`.
- **Alert dispatcher** — supports `stderr`, file output and webhook notification for content-triggered alerts (`src/alerts/`).
- **Knowledge base** — classification rules and professional conventions are versioned and auditable, not hidden in prompt context.

---

## AI agent security baseline (OSS standard)

This project follows the following baseline for open-source AI agents that operate on user data:

1. **Transparency**: the agent declares its capabilities, data sources and decision boundaries before acting (`src/agent/goals.ts`, `docs/agent-quickstart.md`).
2. **Human control**: the operator can review, approve, reject or abort any autonomous plan before execution.
3. **Least privilege**: the agent only reads the mailboxes it needs and never writes beyond the scope approved by the operator.
4. **Auditability**: every action is logged with timestamp, goal, inputs (sanitized), decision and outcome.
5. **Fail-closed**: on ambiguity, high-severity alert or missing confirmation, the agent stops and asks the operator.
6. **No training data exfiltration**: email contents are not sent to external LLM providers by default; the local agent works against the Bridge IMAP/SMTP interface.

---

## Operator checklist before going live

- [ ] `MCP_AUTH_TOKEN` generated with `openssl rand -hex 32` and stored only in deployment secrets.
- [ ] `MCP_ALLOWED_ORIGINS` limited to exact trusted origins (HTTP mode).
- [ ] Image registry uses digest pinning if possible.
- [ ] Bridge vault volume backed up weekly.
- [ ] Agent pipeline configured in dry-run mode until the operator validates its behavior.
- [ ] `ALERT_WEBHOOK_URL` configured for critical alerts (optional but recommended).
- [ ] Review automated workflows quarterly — remove any that invoke destructive tools without human-in-the-loop.

---

## What this agent does NOT protect against

- An attacker who controls the **Bridge host** itself (OS-level access) can read the vault.
- An attacker who **steals both your Proton Mail account password AND the Bridge mailbox password** can impersonate you regardless of this agent.
- The **E2E encryption guarantee of Proton stops at the Bridge boundary** — anything downstream (this agent, the MCP server, any dashboard) operates on plaintext by design.
- The agent is a classifier and workflow helper, not a legal or compliance advisor. Operator is responsible for final decisions on sensitive categories (legal, fiscal, health, official communications).
