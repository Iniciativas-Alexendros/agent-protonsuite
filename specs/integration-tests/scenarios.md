# Scenarios: Integration Testing

| ID   | Escenario                            | Precondición                           | Resultado esperado                                         |
| ---- | ------------------------------------ | -------------------------------------- | ---------------------------------------------------------- |
| SI01 | Smoke Bridge IMAP lista carpetas     | Bridge corriendo, credenciales válidas | listMailboxes() devuelve INBOX, Sent, Trash                |
| SI02 | Smoke Bridge SMTP envía y recibe     | Bridge corriendo                       | Email enviado a sí mismo aparece en INBOX en <60s          |
| SI03 | Smoke Pass CLI lista store           | pass instalado, store inicializado     | pass ls devuelve entradas (o vacío)                        |
| SI04 | Smoke Drive CLI auth status          | proton-drive instalado                 | auth status devuelve "authenticated" o "not authenticated" |
| SI05 | Sin credenciales — Bridge salta      | PROTON_INTEGRATION_TEST no seteado o sin USER/PASS | integrationTest() → it.skip                          |
| SI08 | Binario ausente — Pass/Drive saltan  | pass / proton-drive no están en PATH   | binarySmokeTest() → it.skip (no ENOENT)                    |
| SI06 | Credenciales inválidas — error claro | Bridge user/pass incorrectos           | AUTHENTICATIONFAILED, no timeout                           |
| SI07 | Bridge no corriendo — error claro    | Sin proceso Bridge                     | "Bridge not reachable at 127.0.0.1:1143"                   |
| SI09 | Schedule hosted — verde sin live     | cron en runner GitHub-hosted           | preflight `mode=hosted`; smokes live en skip; exit 0       |
