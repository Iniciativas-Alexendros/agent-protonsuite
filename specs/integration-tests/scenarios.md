# Scenarios: Integration Testing

| ID   | Escenario                            | Precondición                           | Resultado esperado                                         |
| ---- | ------------------------------------ | -------------------------------------- | ---------------------------------------------------------- |
| SI01 | Smoke Bridge IMAP lista carpetas     | Bridge corriendo, credenciales válidas | listMailboxes() devuelve INBOX, Sent, Trash                |
| SI02 | Smoke Bridge SMTP envía y recibe     | Bridge corriendo                       | Email enviado a sí mismo aparece en INBOX en <60s          |
| SI03 | Smoke Pass CLI lista store           | pass instalado, store inicializado     | pass ls devuelve entradas (o vacío)                        |
| SI04 | Smoke Drive CLI auth status          | proton-drive instalado                 | auth status devuelve "authenticated" o "not authenticated" |
| SI05 | Sin credenciales — todos saltan      | PROTON_INTEGRATION_TEST no seteado     | 0 tests ejecutados, todos it.skip                          |
| SI06 | Credenciales inválidas — error claro | Bridge user/pass incorrectos           | AUTHENTICATIONFAILED, no timeout                           |
| SI07 | Bridge no corriendo — error claro    | Sin proceso Bridge                     | "Bridge not reachable at 127.0.0.1:1143"                   |
