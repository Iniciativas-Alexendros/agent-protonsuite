/**
 * Tests unitarios para src/agent/setup.ts (3.94% cobertura).
 *
 * Funciones exportadas:
 *  - runImapCheck(cfg, log) → SetupReport creando ImapClient internamente
 *  - runSetup(cfg, log)     → SetupReport tras runImapCheck + SmtpClient.send()
 *
 * Estrategia de mocks:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  vi.mock(../src/config.js) → resolveBridgeConfig mock       │
 *  │  vi.mock(../src/imap.js)   → MockImapClient (constructor)   │
 *  │  vi.mock(../src/smtp.js)   → MockSmtpClient (constructor)   │
 *  └─────────────────────────────────────────────────────────────┘
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runSetup, runImapCheck } from '../src/agent/setup.js'

// ---------------------------------------------------------------------------
// vi.hoisted — shared state
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  // Nota: mockResolvedValue(undefined) es necesario porque el finally block
  // de runImapCheck hace await imap.close().catch(() => {}). Si close()
  // devuelve undefined (vi.fn() por defecto), undefined.catch() explota.
  const mockImapClose = vi.fn().mockResolvedValue(undefined)
  const mockSmtpClose = vi.fn()
  const mockImapListMailboxes = vi.fn()
  const mockSmtpSend = vi.fn()
  const mockResolveBridgeConfig = vi.fn()

  // resolveBridgeConfig devuelve el mínimo bridge config válido por defecto
  const defaultBridgeCfg = {
    host: '127.0.0.1',
    imapPort: 1143,
    user: 'test',
    passwordResolver: vi.fn(),
    tlsInsecure: true,
  }
  mockResolveBridgeConfig.mockResolvedValue(defaultBridgeCfg)

  class MockImapClient {
    listMailboxes = mockImapListMailboxes as () => Promise<
      Array<{ path: string }>
    >
    close = mockImapClose as () => Promise<void>
  }

  class MockSmtpClient {
    send = mockSmtpSend as (opts: unknown) => Promise<unknown>
    close = mockSmtpClose as () => void
  }

  return {
    mockImapListMailboxes,
    mockImapClose,
    mockSmtpSend,
    mockSmtpClose,
    mockResolveBridgeConfig,
    MockImapClient,
    MockSmtpClient,
  }
})

// ---------------------------------------------------------------------------
// vi.mock
// ---------------------------------------------------------------------------

vi.mock('../src/config.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    resolveBridgeConfig: hoisted.mockResolveBridgeConfig,
  }
})

vi.mock('../src/imap.js', () => ({
  ImapClient: hoisted.MockImapClient,
}))

vi.mock('../src/smtp.js', () => ({
  SmtpClient: hoisted.MockSmtpClient,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const silentLog = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

const defaultCfg = {
  products: {
    mail: {
      enabled: true,
      bridge: {
        host: '127.0.0.1',
        imapPort: 1143,
        smtpPort: 1025,
        user: 'test@proton.me',
        pass: 'test',
        from: 'test@proton.me',
        tlsInsecure: true,
      },
    },
  },
} as never

// ---------------------------------------------------------------------------
// Reseteo
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// runImapCheck
// ===========================================================================

describe('runImapCheck', () => {
  it('retorna éxito cuando listMailboxes devuelve carpetas con INBOX', async () => {
    hoisted.mockImapListMailboxes.mockResolvedValue([
      { path: 'INBOX' },
      { path: 'Sent' },
      { path: 'Trash' },
    ])

    const report = await runImapCheck(defaultCfg, silentLog)

    expect(report.bridgeReachable).toBe(true)
    expect(report.imapOk).toBe(true)
    expect(report.authOk).toBe(true)
    expect(report.folders).toEqual(['INBOX', 'Sent', 'Trash'])
    expect(report.smtpOk).toBe(false) // runImapCheck no toca SMTP
    expect(report.recommendations).toHaveLength(0)
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('retorna éxito con recomendación cuando INBOX no está en folders', async () => {
    hoisted.mockImapListMailboxes.mockResolvedValue([
      { path: 'Sent' },
      { path: 'Drafts' },
    ])

    const report = await runImapCheck(defaultCfg, silentLog)

    expect(report.imapOk).toBe(true)
    expect(report.authOk).toBe(true)
    expect(report.folders).toEqual(['Sent', 'Drafts'])
    expect(report.recommendations).toHaveLength(1)
    expect(report.recommendations[0]).toContain('INBOX')
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('recommendación ECONNREFUSED + INBOX faltante cuando listMailboxes lanza error de conexión', async () => {
    hoisted.mockImapListMailboxes.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:1143'),
    )

    const report = await runImapCheck(defaultCfg, silentLog)

    expect(report.bridgeReachable).toBe(false)
    expect(report.imapOk).toBe(false)
    expect(report.authOk).toBe(false)
    expect(report.folders).toEqual([])
    expect(report.recommendations).toHaveLength(2)
    expect(report.recommendations[0]).toContain('Bridge')
    expect(report.recommendations[0]).toContain('IMAP')
    expect(report.recommendations[1]).toContain('INBOX') // folders vacío → INBOX recommendation
    expect(silentLog.error).toHaveBeenCalled()
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('recommendación de credenciales + INBOX faltante cuando listMailboxes lanza error de auth', async () => {
    hoisted.mockImapListMailboxes.mockRejectedValue(
      new Error('Authentication failed'),
    )

    const report = await runImapCheck(defaultCfg, silentLog)

    expect(report.imapOk).toBe(false)
    expect(report.authOk).toBe(false)
    expect(report.recommendations).toHaveLength(2)
    expect(report.recommendations[0]).toContain('credenciales')
    expect(report.recommendations[1]).toContain('INBOX')
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('recommendación genérica + INBOX faltante cuando listMailboxes lanza error', async () => {
    hoisted.mockImapListMailboxes.mockRejectedValue(
      new Error('IMAP server overloaded'),
    )

    const report = await runImapCheck(defaultCfg, silentLog)

    expect(report.imapOk).toBe(false)
    expect(report.recommendations).toHaveLength(2)
    expect(report.recommendations[0]).toContain('IMAP server overloaded')
    expect(report.recommendations[1]).toContain('INBOX')
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('cierra IMAP incluso cuando listMailboxes lanza', async () => {
    hoisted.mockImapListMailboxes.mockRejectedValue(new Error('any error'))

    await runImapCheck(defaultCfg, silentLog)

    // close debe llamarse en el finally block
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('cierra IMAP incluso cuando close() lanza (catch silencioso)', async () => {
    hoisted.mockResolveBridgeConfig.mockResolvedValue({ host: '127.0.0.1', imapPort: 1143, user: 'test', passwordResolver: vi.fn(), tlsInsecure: true })
    hoisted.mockImapListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockImapClose.mockRejectedValue(new Error('close crashed'))

    const report = await runImapCheck(defaultCfg, silentLog)

    // close() lanza pero se captura con .catch(() => {})
    expect(report.imapOk).toBe(true)
    expect(report.authOk).toBe(true)
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// runSetup
// ===========================================================================

describe('runSetup', () => {
  it('retorna éxito completo cuando IMAP y SMTP funcionan', async () => {
    hoisted.mockImapListMailboxes.mockResolvedValue([
      { path: 'INBOX' },
      { path: 'Sent' },
    ])
    hoisted.mockSmtpSend.mockResolvedValue({
      messageId: '<verify@proton>',
      accepted: ['test@proton.me'],
      rejected: [],
    })

    const report = await runSetup(defaultCfg, silentLog)

    expect(report.bridgeReachable).toBe(true)
    expect(report.imapOk).toBe(true)
    expect(report.smtpOk).toBe(true)
    expect(report.authOk).toBe(true)
    expect(report.folders).toEqual(['INBOX', 'Sent'])

    // La recommendation de éxito debe estar presente
    const successRec = report.recommendations.find(
      (r) => r.includes('configurado correctamente'),
    )
    expect(successRec).toBeDefined()

    // SMTP send llamado con from address como destinatario
    expect(hoisted.mockSmtpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['test@proton.me'],
        subject: expect.stringContaining('verification'),
      }),
    )
    // SMTP close llamado
    expect(hoisted.mockSmtpClose).toHaveBeenCalled()
  })

  it('retorna temprano con solo IMAP cuando IMAP falla (SMTP no se ejecuta)', async () => {
    hoisted.mockImapListMailboxes.mockRejectedValue(
      new Error('connect ECONNREFUSED'),
    )

    const report = await runSetup(defaultCfg, silentLog)

    expect(report.imapOk).toBe(false)
    expect(report.smtpOk).toBe(false)
    // SMTP send NO debe haberse llamado porque runImapCheck falló
    expect(hoisted.mockSmtpSend).not.toHaveBeenCalled()
    expect(hoisted.mockSmtpClose).not.toHaveBeenCalled()
    expect(hoisted.mockImapClose).toHaveBeenCalledTimes(1)
  })

  it('retorna imapOk=true, smtpOk=false cuando SMTP falla', async () => {
    hoisted.mockImapListMailboxes.mockResolvedValue([
      { path: 'INBOX' },
      { path: 'Sent' },
    ])
    hoisted.mockSmtpSend.mockRejectedValue(
      new Error('SMTP connection refused'),
    )

    const report = await runSetup(defaultCfg, silentLog)

    expect(report.imapOk).toBe(true)
    expect(report.smtpOk).toBe(false)
    expect(report.authOk).toBe(true)

    // Recommendation de SMTP error
    const smtpRec = report.recommendations.find((r) => r.includes('SMTP'))
    expect(smtpRec).toBeDefined()
    expect(smtpRec).toContain('SMTP connection refused')

    // Sin recommendation de éxito
    const successRec = report.recommendations.find(
      (r) => r.includes('configurado correctamente'),
    )
    expect(successRec).toBeUndefined()

    // SMTP close llamado incluso tras error
    expect(hoisted.mockSmtpClose).toHaveBeenCalled()
  })

  it('envía correo de verificación con from como destinatario', async () => {
    hoisted.mockImapListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockSmtpSend.mockResolvedValue({
      messageId: '<verify@proton>',
    })

    await runSetup(defaultCfg, silentLog)

    // Verificar que SMTP send recibe los parámetros correctos
    const sendCall = hoisted.mockSmtpSend.mock.calls[0][0] as {
      to: string[]
      subject: string
      text: string
    }
    expect(sendCall.to).toEqual(['test@proton.me'])
    expect(sendCall.subject).toBe('ProtonMail Agent setup verification')
    expect(sendCall.text).toContain('self-addressed verification')
  })
})
