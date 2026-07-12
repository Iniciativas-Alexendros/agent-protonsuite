# Test Plan: MCP Bridge

## Tests unitarios

| Orden | Archivo                                  | Descripción               | Tests                       |
| ----- | ---------------------------------------- | ------------------------- | --------------------------- |
| 1     | tests/bridge/bridge-client.test.ts       | health() con mocks        | 5 tests (S01-S04 + timeout) |
| 2     | tests/bridge/bridge-client.test.ts       | info() parseo regex       | 3 tests (S05-S07)           |
| 3     | tests/bridge/bridge-client.test.ts       | login/logout/listAccounts | 7 tests (S08-S14)           |
| 4     | tests/bridge/bridge-client.test.ts       | spawn/shutdown/isRunning  | 4 tests (S15-S16)           |
| 5     | tests/bridge/bridge-tools.test.ts        | Registro MCP tools        | 6 tests (una por tool)      |
| 6     | tests/ecosystem/installer-bridge.test.ts | installOnUbuntu('bridge') | 2 tests                     |

## Orden de implementación

1. Escribir tests S01-S04 (health) → RED
2. Implementar BridgeClient.health() → GREEN
3. Tests S05-S07 (info) → RED
4. Implementar BridgeClient.info() con regex → GREEN
5. Tests S08-S14 (auth) → RED
6. Implementar login/logout/listAccounts → GREEN
7. Tests S15-S16 (lifecycle) → RED
8. Implementar spawn/shutdown/isRunning → GREEN
9. Tests bridge-tools.test.ts → RED
10. Implementar registerBridgeTools() en server.ts → GREEN
11. Tests installer-bridge.test.ts → RED
12. Implementar installOnUbuntu('bridge') automatizado → GREEN
