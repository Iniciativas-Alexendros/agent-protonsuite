# Contract: MCP Bridge

## BridgeClient (refactorizado)

```typescript
// src/bridge/bridge-client.ts

export interface BridgeConfig {
  bin: string
  imapPort: number
  smtpPort: number
  host: string
}

export interface BridgeInfo {
  user?: string
  version?: string
  bridgePassword?: string
  smtpPort?: number
  imapPort?: number
}

export interface BridgeHealth {
  ok: boolean
  processRunning: boolean
  imapListening: boolean
  smtpListening: boolean
  authOk: boolean
  error?: string
}

export interface BridgeStatus extends BridgeInfo {
  processRunning: boolean
  imapListening: boolean
  smtpListening: boolean
  authOk: boolean
}

export interface BridgeAccount {
  user: string
  state: 'connected' | 'disconnected' | 'connecting'
}

export interface LoginResult {
  ok: boolean
  message: string
  needs2FA?: boolean
}

export class BridgeClient {
  constructor(bin: string, log: SecretLogger)

  info(): Promise<BridgeInfo>
  health(): Promise<BridgeHealth>
  status(): Promise<BridgeStatus>
  listAccounts(): Promise<BridgeAccount[]>
  login(user: string, password: string, totp?: string): Promise<LoginResult>
  logout(): Promise<{ ok: boolean }>

  spawn(): Promise<void>
  shutdown(): Promise<void>
  isRunning(): boolean
}
```

## MCP Tools (nuevas)

| Tool                   | inputSchema                                         | annotations                     |
| ---------------------- | --------------------------------------------------- | ------------------------------- |
| proton_bridge_health   | response_format: 'markdown'\|'json'                 | readOnly, idempotent, openWorld |
| proton_bridge_status   | response_format: 'markdown'\|'json'                 | readOnly, idempotent, openWorld |
| proton_bridge_info     | {}                                                  | readOnly, idempotent, openWorld |
| proton_bridge_login    | user: string.email, password: string, totp?: string | destructive, openWorld          |
| proton_bridge_logout   | {}                                                  | destructive, openWorld          |
| proton_bridge_accounts | response_format: 'markdown'\|'json'                 | readOnly, idempotent, openWorld |
