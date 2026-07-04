---
name: setup-checklist
description: Verifica las precondiciones antes de operar Proton Mail Agent.
---

# Checklist de puesta en marcha

## Para modo stdio (local)

- [ ] Node ≥ 22 instalado: `node -v`.
- [ ] Proton Mail Bridge headless corriendo: `ss -ltn | grep 127.0.0.1:1143`.
- [ ] Bridge password obtenido: `protonmail-bridge-core --cli` → `info`.
- [ ] Cliente MCP configurado con `mcpServers` apuntando a `npx -y @alexendros/protonmail-agent`.
- [ ] Bridge password no está en claro en el disco del cliente (usar wrapper si es posible).
- [ ] Reiniciar sesión del agente para registrar el MCP.
- [ ] `proton_list_folders` responde con las carpetas esperadas.
- [ ] `AGENT_DRY_RUN=true` configurado para las primeras pruebas.
- [ ] `npx -y @alexendros/protonmail-agent setup` reporta IMAP OK y SMTP OK.
- [ ] `npx -y @alexendros/protonmail-agent organize` ha generado un plan en dry-run.

## Para modo HTTP (remoto)

- [ ] Imagen Docker construida: `docker build -t protonmail-agent:test .`.
- [ ] `docker-compose.yml` configurado con `PROTON_BRIDGE_*`, `MCP_AUTH_TOKEN` y `MCP_ALLOWED_ORIGINS`.
- [ ] Login one-off al Bridge en contenedor realizado.
- [ ] Reverse proxy (Traefik/Caddy/Nginx) configurado con TLS y red `proxy-network`.
- [ ] `curl https://tu-dominio.example/healthz` devuelve `{"ok":true}`.
- [ ] Handshake `initialize` con `Mcp-Session-Id` funciona vía curl.
- [ ] `MCP_ALLOWED_ORIGINS` no está vacío en producción.
- [ ] `ALERT_WEBHOOK_URL` configurado si se desean alertas remotas.

## Para desarrollo

- [ ] `npm install` completado.
- [ ] `npm run typecheck` verde.
- [ ] `npm test` verde.
- [ ] `npm run build` genera `dist/`.
- [ ] `npm run smoke` verde (no requiere Bridge real).
- [ ] `npm run license-check` verde.
- [ ] `npm run license-check:prod` verde.
