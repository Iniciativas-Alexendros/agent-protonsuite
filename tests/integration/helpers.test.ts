import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { loadCredentials, hasCredentials } from './helpers'

describe('integration helpers', () => {
  const envKeys = [
    'PROTON_INTEGRATION_TEST',
    'PROTON_BRIDGE_USER',
    'PROTON_BRIDGE_PASS',
    'PROTON_BRIDGE_HOST',
    'PROTON_BRIDGE_IMAP_PORT',
    'PROTON_BRIDGE_SMTP_PORT',
    'PROTON_BRIDGE_TLS_INSECURE',
  ]
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of envKeys) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) {
        delete process.env[k]
      } else {
        process.env[k] = saved[k]
      }
    }
  })

  describe('loadCredentials', () => {
    it('returns null when PROTON_INTEGRATION_TEST is not set', () => {
      expect(loadCredentials()).toBeNull()
    })

    it('returns null when PROTON_INTEGRATION_TEST is false', () => {
      process.env.PROTON_INTEGRATION_TEST = 'false'
      expect(loadCredentials()).toBeNull()
    })

    it('returns null when required env vars missing', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      expect(loadCredentials()).toBeNull()
    })

    it('returns null when PROTON_BRIDGE_USER is missing', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      process.env.PROTON_BRIDGE_PASS = 'pass'
      expect(loadCredentials()).toBeNull()
    })

    it('returns null when PROTON_BRIDGE_PASS is missing', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      process.env.PROTON_BRIDGE_USER = 'user@proton.me'
      expect(loadCredentials()).toBeNull()
    })

    it('returns credentials when all required vars present', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      process.env.PROTON_BRIDGE_USER = 'user@proton.me'
      process.env.PROTON_BRIDGE_PASS = 'bridge-pass'
      const creds = loadCredentials()
      expect(creds).not.toBeNull()
      expect(creds!.bridgeUser).toBe('user@proton.me')
      expect(creds!.bridgePass).toBe('bridge-pass')
      expect(creds!.bridgeHost).toBe('127.0.0.1')
      expect(creds!.bridgeImapPort).toBe(1143)
      expect(creds!.bridgeSmtpPort).toBe(1025)
      expect(creds!.tlsInsecure).toBe(true)
    })

    it('respects custom port values', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      process.env.PROTON_BRIDGE_USER = 'user@proton.me'
      process.env.PROTON_BRIDGE_PASS = 'bridge-pass'
      process.env.PROTON_BRIDGE_HOST = '192.168.1.100'
      process.env.PROTON_BRIDGE_IMAP_PORT = '993'
      process.env.PROTON_BRIDGE_SMTP_PORT = '465'
      process.env.PROTON_BRIDGE_TLS_INSECURE = 'false'
      const creds = loadCredentials()
      expect(creds!.bridgeHost).toBe('192.168.1.100')
      expect(creds!.bridgeImapPort).toBe(993)
      expect(creds!.bridgeSmtpPort).toBe(465)
      expect(creds!.tlsInsecure).toBe(false)
    })
  })

  describe('hasCredentials', () => {
    it('returns false when PROTON_INTEGRATION_TEST not set', () => {
      expect(hasCredentials()).toBe(false)
    })

    it('returns false when required env vars missing', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      expect(hasCredentials()).toBe(false)
    })

    it('returns true when all vars present', () => {
      process.env.PROTON_INTEGRATION_TEST = 'true'
      process.env.PROTON_BRIDGE_USER = 'user@proton.me'
      process.env.PROTON_BRIDGE_PASS = 'bridge-pass'
      expect(hasCredentials()).toBe(true)
    })
  })
})
