# Spec: MCP Bridge — SMTP/IMAP real con Proton Bridge

## Objetivo

Transformar el `BridgeClient` de un stub cosmético (81 líneas, health() no comprueba nada real) a un backend completo que gestione el proceso Bridge, interactúe con su CLI interactivo y exponga herramientas MCP para que el LLM pueda diagnosticar y operar Bridge.

## Requerimientos funcionales

| ID    | Requisito                                                   | Criterio de aceptación                                                |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| BR-01 | health() verifica proceso Bridge corriendo                  | pgrep o /proc confirma que el binario está vivo                       |
| BR-02 | health() verifica puertos IMAP/SMTP en LISTEN               | net.createConnection a 127.0.0.1:1143 y 1025                          |
| BR-03 | health() verifica auth — login IMAP con credenciales        | ImapClient.connect() exitoso = saludable, fallo = ok: false           |
| BR-04 | info() parsea campo Password del bridge password            | Regex captura `Password:\s*(\S+)` del output CLI                      |
| BR-05 | status() agrega info + health en una sola llamada           | Devuelve `{ user, version, running, ports, authed, bridgePassword? }` |
| BR-06 | login() ejecuta login interactivo vía CLI                   | Escribe `login\n` al stdin de --cli, consume prompts secuenciales     |
| BR-07 | logout() cierra sesión Bridge vía CLI                       | Ejecuta `logout\n` en CLI interactivo                                 |
| BR-08 | listAccounts() lista cuentas activas                        | Parsea output de `list\n` en CLI                                      |
| BR-09 | Gestión de ciclo de vida: spawn, healthcheck, kill graceful | spawn() arranca --cli, shutdown() envía `exit\n` + SIGTERM            |
| BR-10 | Registro de 6 MCP tools                                     | proton_bridge_health, _status, _info, _login, _logout, _accounts      |
| BR-11 | proton_bridge_install automatiza wget + dpkg en Ubuntu      | installOnUbuntu('bridge') ejecuta descarga e instalación              |

## Restricciones

- Sin dependencias nuevas (solo node: builtins + deps existentes)
- Compatible con protonmail-bridge-core (headless CLI, prompt `>>>`)
- Bridge password nunca se loguea en claro (SecretLogger.sanitizeForLog)
- Timeout de 30s para operaciones CLI; sin respuesta → error estructurado
