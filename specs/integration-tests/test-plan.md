# Test Plan: Integration Testing

| Orden | Archivo                                       | Tests                                            | Tipo           |
| ----- | --------------------------------------------- | ------------------------------------------------ | -------------- |
| 1     | tests/integration/helpers.test.ts             | loadCredentials, hasCredentials, integrationTest | Unit (sin API) |
| 2     | tests/integration/bridge-smoke.integration.ts | IMAP list, SMTP send+receive                     | Integration    |
| 3     | tests/integration/pass-smoke.integration.ts   | pass ls, pass --version                          | Integration    |
| 4     | tests/integration/drive-smoke.integration.ts  | proton-drive auth status, --version              | Integration    |
| 5     | tests/integration/suite-health.integration.ts | checkAllBinaries + conectividad                  | Integration    |
