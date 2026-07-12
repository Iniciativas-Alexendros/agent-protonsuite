# Contract: Integration Testing

## Test fixtures

```typescript
// tests/integration/helpers.ts

export interface IntegrationCredentials {
  bridgeUser: string
  bridgePass: string
  bridgeHost: string
  bridgeImapPort: number
  bridgeSmtpPort: number
  tlsInsecure: boolean
}

export function loadCredentials(): IntegrationCredentials | null
export function hasCredentials(): boolean
export function integrationTest(name: string, fn: () => Promise<void>): void
```

## Estructura de archivos

```
tests/
├── integration/
│   ├── helpers.ts
│   ├── bridge-smoke.integration.ts
│   ├── pass-smoke.integration.ts
│   ├── drive-smoke.integration.ts
│   └── suite-health.integration.ts
vitest.integration.config.ts
.env.test.example
```

## CI Workflow

```yaml
# .github/workflows/integration.yml
name: Integration Smoke
on:
  schedule: [{ cron: '0 6 * * *' }]
  workflow_dispatch:
jobs:
  integration:
    runs-on: ubuntu-26.04
    env:
      PROTON_BRIDGE_USER: ${{ secrets.PROTON_BRIDGE_USER }}
      PROTON_BRIDGE_PASS: ${{ secrets.PROTON_BRIDGE_PASS }}
      PROTON_INTEGRATION_TEST: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test:integration
```
