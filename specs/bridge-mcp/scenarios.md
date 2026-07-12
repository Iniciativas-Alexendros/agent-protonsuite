# Scenarios: MCP Bridge

| ID  | Escenario                                       | Input                                                 | Resultado esperado                                                                           |
| --- | ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| S01 | health con Bridge corriendo y autenticado       | binario existe, proceso vivo, puertos LISTEN, IMAP ok | `{ ok: true, processRunning: true, imapListening: true, smtpListening: true, authOk: true }` |
| S02 | health con Bridge no instalado                  | binario no existe                                     | `{ ok: false, processRunning: false, error: 'not found' }`                                   |
| S03 | health con Bridge instalado pero no corriendo   | binario existe, proceso no                            | `{ ok: false, processRunning: false, error: 'process not running' }`                         |
| S04 | health con Bridge corriendo pero no autenticado | proceso vivo, puertos no LISTEN                       | `{ ok: false, processRunning: true, imapListening: false, authOk: false }`                   |
| S05 | info con sesión activa                          | `>>> info` output completo                            | `{ user: 'x@proton.me', version: '3.x', bridgePassword: 'abc...' }`                          |
| S06 | info sin sesión (no login)                      | Bridge corriendo sin login                            | `{ user: undefined, version: '3.x' }`                                                        |
| S07 | status agrega health + info                     | Bridge operativo                                      | Todos los campos de info + flags de health                                                   |
| S08 | login con credenciales correctas                | usuario + pass válidos                                | `{ ok: true, message: 'logged in' }`                                                         |
| S09 | login con 2FA requerido                         | usuario + pass válidos, TOTP activado                 | `{ ok: false, needs2FA: true }`                                                              |
| S10 | login con 2FA + TOTP                            | usuario + pass + totp válidos                         | `{ ok: true }`                                                                               |
| S11 | login con credenciales incorrectas              | usuario + pass inválidos                              | `{ ok: false, message: 'authentication failed' }`                                            |
| S12 | logout con sesión activa                        | CLI interactivo `>>> logout`                          | `{ ok: true }`                                                                               |
| S13 | logout sin Bridge corriendo                     | proceso no existe                                     | `{ ok: false }`                                                                              |
| S14 | listAccounts con 2 cuentas                      | `>>> list` 2 líneas                                   | `[{user:'a@proton.me', state:'connected'}, ...]`                                             |
| S15 | spawn arranca Bridge                            | binario válido                                        | Proceso vivo, `>>>` prompt detectado en 15s                                                  |
| S16 | shutdown cierra graceful                        | proceso vivo                                          | `exit\n` + SIGTERM, proceso muerto en 10s                                                    |
| S17 | CLI timeout — Bridge no responde                | binario sin respuesta en 30s                          | `{ ok: false, error: 'timeout after 30s' }`                                                  |
