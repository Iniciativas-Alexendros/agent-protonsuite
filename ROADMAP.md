# Roadmap de Proton Mail Agent

Plan a alto nivel. No son compromisos firmes; las prioridades pueden cambiar según el contexto operativo. El detalle por versión publicada vive en `CHANGELOG.md`; las decisiones de fondo en `docs/adr/`.

## Estado actual

`v0.5.0` publicado. El paquete funciona como agente de correo con MCP server embebido: 14 tools (`stdio` + `streamable HTTP`), agente autónomo (`setup`, `organize`, `monitor`, `alert`), subsistema de alertas de contenido con knowledge base local, tests Vitest en verde, typecheck `strict`, build `tsc`, smoke `stdio` y `license-check` integrados en CI (matrix Node 20/22, `npm audit`, CodeQL). Licencia AGPL-3.0.

## En curso · release gates

- [x] Rebrand a `@alexendros/protonmail-agent` con binario `protonmail-agent` y repositorio `agent-protonmail`.
- [x] Cambio de licencia a AGPL-3.0 con `NOTICE.md`.
- [x] Actualización de `SECURITY.md` con threat model de agentes IA.
- [ ] Publicación estable en el MCP Registry (`io.github.Alexendros/protonmail-agent`), consolidando el flujo de publicación.
- [ ] Verificación del workflow `release.yml` empujando a `ghcr.io/iniciativas-alexendros/agent-protonmail:{sha,latest}`.

## Próximos · funcionalidad

- [x] Tests E2E con Bridge de prueba (GreenMail + SMTP mock) para cubrir el camino IMAP/SMTP real sin cuenta productiva.
- [ ] `outputSchema` con `structuredContent` en las tools de lectura cuando el SDK lo materialice mejor.
- [ ] `proton_watch_inbox` con IDLE + webhook (flujos event-driven sin polling).
- [ ] Soporte multi-alias (Proton permite varias direcciones por cuenta).
- [ ] Configurabilidad del playbook de triaje por env vars.
- [ ] Workflows de agente programables (rules, scheduled runs, expiración de alertas).
- [ ] Export/import del knowledge base de clasificación como YAML para operadores.

## Próximos · hardening

- [ ] Bridge CA pinning opcional (`PROTON_BRIDGE_CA_PATH`) para cerrar `PROTON_BRIDGE_TLS_INSECURE` en producción estricta (mitiga T7).
- [ ] Human-in-the-loop forzado en tools destructivas (`proton_delete_email mode=permanent`) para acotar T4.
- [ ] Digest pinning de la imagen GHCR en despliegues Docker.
- [ ] Alert throttling y deduplicación para mitigar alert fatigue.
- [ ] Sandbox de reglas de agente (dry-run automático si cambian las reglas).

## Backlog

- [ ] Métricas/observabilidad del endpoint HTTP.
- [ ] Cliente fetch minimalista de ejemplo para Next.js / FastAPI / etc.
- [ ] Consumo de `proton_agent_plan` desde clientes MCP como asistente nativo.

## Completado

- [x] 2026-07-04 · `v0.5.0`: agente autónomo (`discover`, `setup`, `organize`, `monitor`, `alert`), alertas de contenido, knowledge base local, tool `proton_agent_plan`, licencia AGPL-3.0, rebrand a `agent-protonmail`.
- [x] 2026-06-20 · `v0.4.0`: 13 tools, E2E GreenMail, single-source version, npm publish en CI.
- [x] 2026-05-18 · `v0.2.0`: identidad fijada en `protonmail-mcp`, sección "Marcas comerciales" en README.
- [x] 2026-05-02 · `v0.1.2`: casing canónico `Alexendros` para el MCP Registry.
- [x] 2026-05-01 · `v0.1.0`: primera release pública, 13 tools, doble transporte, bundle de gobernanza (CONTRIBUTING, SECURITY, CoC, templates).
- [x] 2026-05-29 · canon de documentación del repositorio aplicado.
