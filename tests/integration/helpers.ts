import { it } from 'vitest'

export interface IntegrationCredentials {
  bridgeUser: string
  bridgePass: string
  bridgeHost: string
  bridgeImapPort: number
  bridgeSmtpPort: number
  tlsInsecure: boolean
}

export function loadCredentials(): IntegrationCredentials | null {
  if (process.env.PROTON_INTEGRATION_TEST !== 'true') return null

  const user = process.env.PROTON_BRIDGE_USER
  const pass = process.env.PROTON_BRIDGE_PASS
  if (!user || !pass) return null

  return {
    bridgeUser: user,
    bridgePass: pass,
    bridgeHost: process.env.PROTON_BRIDGE_HOST ?? '127.0.0.1',
    bridgeImapPort: Number(process.env.PROTON_BRIDGE_IMAP_PORT ?? 1143),
    bridgeSmtpPort: Number(process.env.PROTON_BRIDGE_SMTP_PORT ?? 1025),
    tlsInsecure: process.env.PROTON_BRIDGE_TLS_INSECURE !== 'false',
  }
}

export function hasCredentials(): boolean {
  return loadCredentials() !== null
}

export function integrationTest(name: string, fn: () => Promise<void>): void {
  if (hasCredentials()) {
    it(name, fn)
  } else {
    it.skip(name)
  }
}
