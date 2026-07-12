# Spec: Integration Testing con Proton APIs reales

## Objetivo

Añadir una capa de tests de integración que validen conectividad real contra las APIs de Proton (Bridge IMAP/SMTP, Pass CLI, Drive CLI) usando credenciales reales. Los tests se saltan automáticamente si no hay credenciales configuradas.

## Requerimientos funcionales

| ID    | Requisito                              | Criterio de aceptación                                |
| ----- | -------------------------------------- | ----------------------------------------------------- |
| IT-01 | Infraestructura separada de unitarios  | `tests/integration/` con vitest.integration.config.ts |
| IT-02 | Tests saltan graceful sin credenciales | `PROTON_INTEGRATION_TEST=true` como gate              |
| IT-03 | Smoke test: Bridge IMAP conectividad   | ImapClient.connect() → listMailboxes() → ver INBOX    |
| IT-04 | Smoke test: Bridge SMTP envío          | SmtpClient.send() a sí mismo → ver en INBOX           |
| IT-05 | Smoke test: Pass CLI salud             | pass --version → pass ls                              |
| IT-06 | Smoke test: Drive CLI salud            | proton-drive --version → auth status                  |
| IT-07 | Credenciales desde .env.test           | loadIntegrationCredentials() lee ~/.env.test          |
| IT-08 | CI workflow con GitHub Actions         | .github/workflows/integration.yml con secrets         |
| IT-09 | Timeouts generosos (60s)               | testTimeout: 60_000                                   |
| IT-10 | Reporte claro de tests saltados        | Header en output                                      |

## Restricciones

- Sin dependencias nuevas
- Tests se saltan si no hay credenciales (nunca fallan por config faltante)
- Credenciales NUNCA en código fuente ni en el repo
- .env.test en .gitignore
