import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { it } from 'vitest'

export interface IntegrationCredentials {
  bridgeUser: string
  bridgePass: string
  bridgeHost: string
  bridgeImapPort: number
  bridgeSmtpPort: number
  tlsInsecure: boolean
}

type TestFn = () => void | Promise<void>

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

/** True if `name` is an executable on PATH (no shell). */
export function hasBinary(name: string): boolean {
  const pathEnv = process.env.PATH ?? ''
  return pathEnv.split(delimiter).some((dir) => dir.length > 0 && existsSync(join(dir, name)))
}

/** True if a pass store directory exists (PASSWORD_STORE_DIR or ~/.password-store). */
export function hasPassStore(): boolean {
  const store = process.env.PASSWORD_STORE_DIR ?? join(homedir(), '.password-store')
  return existsSync(store)
}

/**
 * Bridge IMAP/SMTP smoke. Skip unless `PROTON_INTEGRATION_TEST=true` and
 * Bridge credentials are present. Hosted runners must not inject those
 * secrets; use `workflow_dispatch` + `bridge-real=true`.
 */
export function integrationTest(name: string, fn: TestFn): void {
  if (hasCredentials()) {
    it(name, fn)
  } else {
    it.skip(name)
  }
}

/**
 * CLI smoke (pass / proton-drive). Skip when the binary is not installed
 * instead of failing with ENOENT on GitHub-hosted runners.
 */
export function binarySmokeTest(name: string, binary: string, fn: TestFn): void {
  if (hasBinary(binary)) {
    it(name, fn)
  } else {
    it.skip(name)
  }
}
