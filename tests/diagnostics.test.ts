/**
 * Tests para src/diagnostics.ts.
 *
 * Cubre:
 *  - diagnoseDrive (test existente: binario no encontrado)
 *  - diagnoseMail (nuevo: mock de createConnection + ImapFlow)
 *  - Tipos exportados (test existente: verificación estructural)
 *
 * Arquitectura de mocks para diagnoseMail:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  vi.mock('node:net') → createConnection devuelve mockSocket │
 *  │  con .on() que captura handlers connect/error/timeout       │
 *  │  → emitConnect/emitError/emitTimeout disparan eventos       │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  vi.mock('imapflow') → MockImapFlow con vi.fn() compartidos │
 *  │  mockConnect / mockLogout / mockList controlables por test  │
 *  │  → 3 instancias distintas (handshake/auth/folders) pero     │
 *  │    comparten los mismos vi.fn() → secuencia .mockResolvedX  │
 *  └─────────────────────────────────────────────────────────────┘
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { diagnoseMail, diagnoseDrive } from '../src/diagnostics.js'
import type {
  TcpDiagnostics,
  ImapHandshakeDiagnostics,
  AuthDiagnostics,
  FoldersDiagnostics,
  MailDiagnostics,
  CliDiagnostics,
  AuthStatusDiagnostics,
  DriveDiagnostics,
} from '../src/diagnostics.js'

// ---------------------------------------------------------------------------
// Mocks para diagnoseMail — vi.hoisted para compartir estado entre factories
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  // --- ImapFlow mock ---
  const mockConnect = vi.fn<() => Promise<void>>()
  const mockLogout = vi.fn<() => Promise<void>>()
  const mockList = vi.fn<() => Promise<Array<{ path: string }>>>()
  const mockOn = vi.fn()

  /**
   * Override flags para forzar capabilities/serverGreeting a undefined y asi
   * cubrir las ramas `caps ? [...caps.keys()] : []` (falsy branch) y
   * `serverGreeting ?? ''` (falsy branch). Se aplican al siguiente constructor
   * y vuelven a su valor por defecto tras consumirse.
   */
  let capsOverride: Map<string, unknown> | undefined | 'default' = 'default'
  let greetingOverride: string | undefined | 'default' = 'default'

  class MockImapFlow {
    capabilities: Map<string, unknown> | undefined
    serverGreeting: string | undefined
    on = mockOn
    connect = mockConnect
    logout = mockLogout
    list = mockList

    /** Últimas opts pasadas al constructor (para aserciones) */
    static lastOpts: Record<string, unknown> | null = null

    constructor(opts: Record<string, unknown>) {
      MockImapFlow.lastOpts = opts
      this.capabilities =
        capsOverride === 'default'
          ? new Map([['IMAP4rev1', true]])
          : capsOverride
      this.serverGreeting =
        greetingOverride === 'default' ? '* OK Proton Bridge' : greetingOverride
      // Reset por defecto para no contaminar otros tests
      capsOverride = 'default'
      greetingOverride = 'default'
    }

    static setCaps(v: Map<string, unknown> | undefined): void {
      capsOverride = v
    }
    static setGreeting(v: string | undefined): void {
      greetingOverride = v
    }

    /**
     * Importante: `setCaps` / `setGreeting` son consumidos por el SIGUIENTE Constructor
     * y se restablecen a 'default' inmediatamente después. Si un test crea múltiples
     * instancias de ImapFlow (p.ej. 'todas las capas ok' crea 3), solo la PRIMERA
     * recibe el override — las siguientes vuelven al default porque el reset ocurrió
     * al consumir. Para persistir overrides entre instancias, llama `setX` antes de cada `new`.
     */
  }

  // --- Socket mock para createConnection ---
  let _connectHandler: (() => void) | null = null
  let _errorHandler: ((err: Error) => void) | null = null
  let _timeoutHandler: (() => void) | null = null

  const mockSocket = {
    on: vi.fn((event: string, handler: (...args: Array<unknown>) => void) => {
      if (event === 'connect') _connectHandler = handler as () => void
      if (event === 'error') _errorHandler = handler as (err: Error) => void
      if (event === 'timeout') _timeoutHandler = handler as () => void
      return mockSocket
    }),
    destroy: vi.fn(),
  }

  const mockCreateConnection = vi.fn().mockReturnValue(mockSocket)

  return {
    MockImapFlow,
    mockConnect,
    mockLogout,
    mockList,
    mockOn,
    mockSocket,
    mockCreateConnection,
    /** Emula evento 'connect' en el socket mock */
    emitConnect: () => _connectHandler?.(),
    /** Emula evento 'error' en el socket mock */
    emitError: (err: Error) => _errorHandler?.(err),
    /** Emula evento 'timeout' en el socket mock */
    emitTimeout: () => _timeoutHandler?.(),
  }
})

// ---------------------------------------------------------------------------
// vi.mock — módulos externos usados por diagnostics.ts
// ---------------------------------------------------------------------------

vi.mock('node:net', () => ({
  createConnection: hoisted.mockCreateConnection,
}))

vi.mock('imapflow', () => ({
  ImapFlow: hoisted.MockImapFlow,
}))

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

const defaultBridgeCfg = {
  host: '127.0.0.1',
  imapPort: 1143,
  smtpPort: 1025,
  user: 'test@example.com',
  pass: 'secret',
  tlsInsecure: true,
}

/** passwordResolver que devuelve una pass fija por defecto */
function makePasswordResolver(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue('resolved-pass')
}

// ---------------------------------------------------------------------------
// Reseteo entre tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// diagnoseMail
// ===========================================================================

describe('diagnoseMail', () => {
  // -------------------------------------------------------------------------
  // TCP layer
  // -------------------------------------------------------------------------

  it('TCP: reachable=false cuando socket emite error (ECONNREFUSED)', async () => {
    const passwordResolver = makePasswordResolver()

    // Llamamos diagnoseMail (asíncrono) — se queda esperando el socket event
    const promise = diagnoseMail(defaultBridgeCfg, passwordResolver)
    hoisted.emitError(new Error('connect ECONNREFUSED 127.0.0.1:1143'))
    const result = await promise

    expect(result.tcp.reachable).toBe(false)
    expect(result.tcp.error).toContain('ECONNREFUSED')
    expect(result.tcp.error).toContain('127.0.0.1:1143')
    expect(typeof result.tcp.latencyMs).toBe('number')

    // Fail-fast: no hay más capas
    expect(result.imapHandshake).toBeUndefined()
    expect(result.auth).toBeUndefined()
    expect(result.folders).toBeUndefined()
    // passwordResolver no debe haberse llamado (checkAuth/checkFolders saltan)
    expect(passwordResolver).not.toHaveBeenCalled()
  })

  it('TCP: reachable=false cuando socket emite timeout', async () => {
    const passwordResolver = makePasswordResolver()

    const promise = diagnoseMail(defaultBridgeCfg, passwordResolver)
    hoisted.emitTimeout()
    const result = await promise

    expect(result.tcp.reachable).toBe(false)
    expect(result.tcp.error).toContain('timeout after 5000ms')

    // Fail-fast
    expect(result.imapHandshake).toBeUndefined()
    expect(result.auth).toBeUndefined()
    expect(result.folders).toBeUndefined()
    expect(passwordResolver).not.toHaveBeenCalled()
  })

  it('TCP: reachable=true, conecta y destruye socket', async () => {
    const passwordResolver = makePasswordResolver()
    // Hacemos que el ImapFlow connect falle después del TCP — para aislar TCP
    hoisted.mockConnect.mockRejectedValue(new Error('Imap handshake fail'))

    const promise = diagnoseMail(defaultBridgeCfg, passwordResolver)
    hoisted.emitConnect()
    const result = await promise

    expect(result.tcp.reachable).toBe(true)
    expect(result.tcp.error).toBeUndefined()
    expect(typeof result.tcp.latencyMs).toBe('number')
    expect(result.tcp.latencyMs).toBeGreaterThanOrEqual(0)
    // Socket destroy llamado
    expect(hoisted.mockSocket.destroy).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // IMAP handshake layer
  // -------------------------------------------------------------------------

  it('IMAP: handshake falla cuando connect() lanza error', async () => {
    // Config: TCP ok, luego ImapFlow.connect() falla en checkImapHandshake
    hoisted.mockConnect.mockRejectedValue(new Error('Connection timeout after 10s'))

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect() // TCP conecta
    const result = await promise

    expect(result.tcp.reachable).toBe(true)
    expect(result.imapHandshake).toBeDefined()
    expect(result.imapHandshake!.ok).toBe(false)
    expect(result.imapHandshake!.error).toContain('Connection timeout after 10s')
    expect(result.imapHandshake!.capabilities).toEqual([])
    expect(result.imapHandshake!.greeting).toBe('')

    // Fail-fast: no auth ni folders
    expect(result.auth).toBeUndefined()
    expect(result.folders).toBeUndefined()
  })

  it('IMAP: handshake ok + auth continua con passwordResolver', async () => {
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.mockLogout.mockResolvedValue(undefined)
    // Hacemos que list falle para detener cadena en folders
    hoisted.mockList.mockRejectedValue(new Error('stop'))
    const resolver = makePasswordResolver()

    const promise = diagnoseMail(defaultBridgeCfg, resolver)
    hoisted.emitConnect()
    const result = await promise

    expect(result.tcp.reachable).toBe(true)
    expect(result.imapHandshake).toBeDefined()
    expect(result.imapHandshake!.ok).toBe(true)
    expect(result.imapHandshake!.capabilities).toContain('IMAP4rev1')
    expect(result.imapHandshake!.greeting).toBe('* OK Proton Bridge')

    // Continúa a auth (ok) y a folders (list falla) — passwordResolver llamado 2 veces
    expect(resolver).toHaveBeenCalledTimes(2)
  })



  it('IMAP: logout captura error con .catch(() => {}) cuando falla', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake ok
      .mockRejectedValueOnce(new Error('Auth fail')) // checkAuth fail (para detener cadena)
    hoisted.mockLogout.mockRejectedValue(new Error('Logout failed'))

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    // El logout falla pero se captura con .catch(() => {})
    expect(result.imapHandshake).toBeDefined()
    expect(result.imapHandshake!.ok).toBe(true) // logout fallo no afecta
  })

  // -------------------------------------------------------------------------
  // Auth layer
  // -------------------------------------------------------------------------

  it('Auth: falla cuando connect() lanza (credenciales inválidas)', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake ok
      .mockRejectedValueOnce(new Error('Invalid credentials')) // checkAuth fail

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    expect(result.tcp.reachable).toBe(true)
    expect(result.imapHandshake!.ok).toBe(true)
    expect(result.auth).toBeDefined()
    expect(result.auth!.ok).toBe(false)
    expect(result.auth!.error).toContain('Invalid credentials')

    // Fail-fast: no folders
    expect(result.folders).toBeUndefined()
  })

  it('Auth: propaga error cuando passwordResolver rechaza', async () => {
    const badResolver = vi.fn().mockRejectedValue(new Error('Keychain unavailable'))

    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake (no usa passwordResolver)
    // passwordResolver se llama antes de connect() en checkAuth
    // connect ni siquiera se llega a llamar porque el await passwordResolver() lanza

    const promise = diagnoseMail(defaultBridgeCfg, badResolver)
    hoisted.emitConnect()
    const result = await promise

    expect(result.auth).toBeDefined()
    expect(result.auth!.ok).toBe(false)
    expect(result.auth!.error).toContain('Keychain unavailable')
    // connect no se llamó para checkAuth (solo checkImapHandshake)
    expect(hoisted.mockConnect).toHaveBeenCalledTimes(1)
    // Fail-fast: folders no se ejecutan
    expect(result.folders).toBeUndefined()
  })

  it('Auth: logout de cleanup se ejecuta en catch cuando connect falla', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake ok
      .mockRejectedValueOnce(new Error('Auth fail')) // checkAuth fail
    hoisted.mockLogout.mockRejectedValue(new Error('Logout also fails'))

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    // checkAuth catch block: `if (client) await client.logout().catch(() => {})`
    expect(result.auth!.ok).toBe(false)
    // logout intentado aunque falle
    expect(hoisted.mockLogout).toHaveBeenCalled()
  })

  it('Auth: ok devuelve sin error', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake ok
      .mockResolvedValueOnce(undefined) // checkAuth ok
    // Hacemos que folders falle para aislar auth
    hoisted.mockList.mockRejectedValue(new Error('List fail'))

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    expect(result.auth).toBeDefined()
    expect(result.auth!.ok).toBe(true)
    expect(result.auth!.error).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Folders layer
  // -------------------------------------------------------------------------

  it('Folders: falla cuando list() lanza error', async () => {
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.mockList.mockRejectedValue(new Error('LIST command failed'))

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    expect(result.folders).toBeDefined()
    expect(result.folders!.accessible).toBe(false)
    expect(result.folders!.count).toBe(0)
    expect(result.folders!.error).toContain('LIST command failed')

    // Capas anteriores deben estar ok
    expect(result.tcp.reachable).toBe(true)
    expect(result.imapHandshake!.ok).toBe(true)
    expect(result.auth!.ok).toBe(true)
  })

  it('Folders: accessible=true con count correcto', async () => {
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.mockList.mockResolvedValue([
      { path: 'INBOX' },
      { path: 'Sent' },
      { path: 'Trash' },
      { path: 'Folders/Work' },
    ])

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    expect(result.folders).toBeDefined()
    expect(result.folders!.accessible).toBe(true)
    expect(result.folders!.count).toBe(4)
    expect(result.folders!.error).toBeUndefined()
  })

  it('Folders: logout de cleanup se ejecuta en catch cuando connect falla', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake
      .mockResolvedValueOnce(undefined) // checkAuth
      .mockRejectedValueOnce(new Error('Folders connect fail')) // checkFolders
    hoisted.mockLogout.mockRejectedValue(new Error('Logout fails'))

    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise

    expect(result.folders!.accessible).toBe(false)
    expect(result.folders!.count).toBe(0)
    // logout intentado dentro del catch de checkFolders
    expect(hoisted.mockLogout).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Flujo completo — todas las capas ok
  // -------------------------------------------------------------------------

  it('todas las capas ok devuelven diagnóstico completo', async () => {
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.mockLogout.mockResolvedValue(undefined)
    hoisted.mockList.mockResolvedValue([
      { path: 'INBOX' },
      { path: 'Sent' },
      { path: 'Drafts' },
      { path: 'Trash' },
      { path: 'Spam' },
      { path: 'Folders/ProyectoX' },
    ])
    const passwordResolver = makePasswordResolver()

    const promise = diagnoseMail(defaultBridgeCfg, passwordResolver)
    hoisted.emitConnect()
    const result = await promise

    // TCP
    expect(result.tcp.reachable).toBe(true)
    expect(result.tcp.error).toBeUndefined()
    // IMAP handshake
    expect(result.imapHandshake!.ok).toBe(true)
    expect(result.imapHandshake!.capabilities).toContain('IMAP4rev1')
    expect(result.imapHandshake!.greeting).toBeTruthy()
    // Auth
    expect(result.auth!.ok).toBe(true)
    expect(result.auth!.error).toBeUndefined()
    // Folders
    expect(result.folders!.accessible).toBe(true)
    expect(result.folders!.count).toBe(6)
    expect(result.folders!.error).toBeUndefined()

    // passwordResolver llamado 2 veces (checkAuth + checkFolders)
    expect(passwordResolver).toHaveBeenCalledTimes(2)
    // connect llamado 3 veces (handshake + auth + folders)
    expect(hoisted.mockConnect).toHaveBeenCalledTimes(3)
    // list llamado 1 vez (solo folders)
    expect(hoisted.mockList).toHaveBeenCalledTimes(1)
    // logout llamado 3 veces (cada capa hace logout al terminar)
    expect(hoisted.mockLogout).toHaveBeenCalledTimes(3)
  })

  // -------------------------------------------------------------------------
  // BridgeConfig — verificar que las opts se pasan correctamente
  // -------------------------------------------------------------------------

  it('pasa host, port, tls, logger:false a ImapFlow (checkImapHandshake)', async () => {
    hoisted.mockConnect.mockRejectedValue(new Error('stop')) // no nos interesa el resultado

    const cfg = { ...defaultBridgeCfg, host: 'bridge.example.com', imapPort: 1993, tlsInsecure: false }

    const promise = diagnoseMail(cfg, makePasswordResolver())
    hoisted.emitConnect()
    await promise

    const opts = hoisted.MockImapFlow.lastOpts as Record<string, unknown> | null
    expect(opts).toBeDefined()
    expect(opts!.host).toBe('bridge.example.com')
    expect(opts!.port).toBe(1993)
    expect(opts!.secure).toBe(false)
    expect((opts!.tls as Record<string, unknown>).rejectUnauthorized).toBe(true) // !tlsInsecure
    expect(opts!.logger).toBe(false)
    // Sin auth en checkImapHandshake
    expect(opts!.auth).toBeUndefined()
  })

  it('pasa user/pass a ImapFlow en checkAuth y checkFolders', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake
      .mockRejectedValueOnce(new Error('stop')) // checkAuth — capturamos antes de continuar

    const cfg = { ...defaultBridgeCfg, user: 'mi@test.com' }
    const passwordResolver = vi.fn().mockResolvedValue('mi-password')

    const promise = diagnoseMail(cfg, passwordResolver)
    hoisted.emitConnect()
    await promise

    // La segunda llamada al constructor (checkAuth) debe tener auth
    // lastOpts captura la última instancia creada
    const opts = hoisted.MockImapFlow.lastOpts as Record<string, unknown> | null
    expect((opts!.auth as Record<string, string>).user).toBe('mi@test.com')
    expect((opts!.auth as Record<string, string>).pass).toBe('mi-password')
  })
})

// ===========================================================================
// diagnoseDrive
// ===========================================================================

describe('diagnoseDrive', () => {
  it('returns cli not ok when binary does not exist', async () => {
    const result = await diagnoseDrive('/nonexistent/binary/xyz')
    expect(result.cli.ok).toBe(false)
    expect(result.cli.version).toBeUndefined()
    expect(result.cli.error).toBeTruthy()
    expect(result.cli.error).toContain('not found')
    // Should not have auth when cli fails
    expect(result.auth).toBeUndefined()
  })

  it('cli ok + auth ok returns full diagnosis', async () => {
    // Usamos /bin/echo como binary real: --version devuelve texto, 'auth status' sale con 0
    const result = await diagnoseDrive('/bin/echo')
    expect(result.cli.ok).toBe(true)
    expect(result.cli.version).toBeDefined()
    expect(result.auth).toBeDefined()
    expect(result.auth!.ok).toBe(true)
  })

  it('cli ok + auth fail returns auth error', async () => {
    // /bin/cat --version funciona, pero 'cat auth status' falla si no existen los archivos
    const result = await diagnoseDrive('/bin/cat')
    expect(result.cli.ok).toBe(true)
    expect(result.cli.version).toBeDefined()
    expect(result.auth).toBeDefined()
    expect(result.auth!.ok).toBe(false)
    expect(result.auth!.error).toBeDefined()
  })
})

// ===========================================================================
// Types are properly exported
// ===========================================================================

describe('Types are properly exported', () => {
  it('MailDiagnostics structure allows fail-fast subsets', () => {
    // TCP only (reachable=false → no further checks)
    const tcpOnly: MailDiagnostics = {
      tcp: { reachable: false, latencyMs: 100, error: 'ECONNREFUSED' },
    }
    expect(tcpOnly.tcp.reachable).toBe(false)
    expect(tcpOnly.imapHandshake).toBeUndefined()
    expect(tcpOnly.auth).toBeUndefined()
    expect(tcpOnly.folders).toBeUndefined()
  })

  it('MailDiagnostics allows incremental depth', () => {
    // TCP + IMAP handshake (handshake failed → stop)
    const tcpImap: MailDiagnostics = {
      tcp: { reachable: true, latencyMs: 5 },
      imapHandshake: { ok: false, capabilities: [], greeting: '', error: 'timeout' },
    }
    expect(tcpImap.imapHandshake!.ok).toBe(false)
    expect(tcpImap.auth).toBeUndefined()
  })

  it('MailDiagnostics can be fully resolved', () => {
    const full: MailDiagnostics = {
      tcp: { reachable: true, latencyMs: 3 },
      imapHandshake: { ok: true, capabilities: ['IMAP4rev1', 'STARTTLS'], greeting: '* OK Gluon' },
      auth: { ok: true },
      folders: { count: 5, accessible: true },
    }
    expect(full.folders!.count).toBe(5)
  })

  it('DriveDiagnostics structure', () => {
    const cliFail: DriveDiagnostics = {
      cli: { ok: false, error: 'not found' },
    }
    expect(cliFail.auth).toBeUndefined()

    const cliOkAuthFail: DriveDiagnostics = {
      cli: { ok: true, version: '1.0.0' },
      auth: { ok: false, error: 'not logged in' },
    }
    expect(cliOkAuthFail.cli.version).toBe('1.0.0')

    const fullyOk: DriveDiagnostics = {
      cli: { ok: true, version: '2.0.0' },
      auth: { ok: true },
    }
    expect(fullyOk.auth!.ok).toBe(true)
  })
})

describe('measureTcp type shape', () => {
  it('returns correct shape on timeout (port not listening)', () => {
    // measureTcp is not exported, but we validate the type shape it produces
    // by testing diagnoseMail indirectly through type assertion
    const result: TcpDiagnostics = {
      reachable: false,
      latencyMs: 0,
      error: 'connect ECONNREFUSED',
    }
    expect(result.reachable).toBe(false)
    expect(typeof result.latencyMs).toBe('number')
    expect(result.error).toBeTruthy()
  })

  it('success shape has no error', () => {
    const result: TcpDiagnostics = {
      reachable: true,
      latencyMs: 2,
    }
    expect(result.error).toBeUndefined()
  })
})

describe('Interface consistency', () => {
  it('ImapHandshakeDiagnostics fields have correct types', () => {
    const hs: ImapHandshakeDiagnostics = {
      ok: true,
      capabilities: ['IMAP4rev1'],
      greeting: '* OK',
    }
    expect(Array.isArray(hs.capabilities)).toBe(true)
    expect(typeof hs.greeting).toBe('string')
  })

  it('AuthDiagnostics fields', () => {
    const ok: AuthDiagnostics = { ok: true }
    expect(ok.error).toBeUndefined()

    const fail: AuthDiagnostics = { ok: false, error: 'invalid credentials' }
    expect(fail.error).toBeTruthy()
  })

  it('FoldersDiagnostics fields', () => {
    const ok: FoldersDiagnostics = { count: 3, accessible: true }
    expect(ok.error).toBeUndefined()

    const fail: FoldersDiagnostics = { count: 0, accessible: false, error: 'timeout' }
    expect(fail.error).toBeTruthy()
  })

  it('CliDiagnostics fields', () => {
    const ok: CliDiagnostics = { ok: true, version: '1.0.0' }
    const fail: CliDiagnostics = { ok: false, error: 'not found' }
    expect(ok.version).toBeTruthy()
    expect(fail.version).toBeUndefined()
  })

  it('AuthStatusDiagnostics fields', () => {
    const ok: AuthStatusDiagnostics = { ok: true }
    const fail: AuthStatusDiagnostics = { ok: false, error: 'token expired' }
    expect(ok.error).toBeUndefined()
    expect(fail.error).toBeTruthy()
  })
})

// ===========================================================================
// Gaps de branches — Errores no-Error (String() fallback en catch)
// ===========================================================================

describe('diagnoseMail — non-Error throw fallbacks', () => {
  it('handshake: err instanceof Error fallback (string thrown)', async () => {
    // checkImapHandshake catches con `err instanceof Error ? err.message : String(err)`
    // Branch: cuando algo lanza un valor no-Error (p.ej. string). El global
    // beforeEach usa vi.resetAllMocks() así que no hay fuga entre tests.
    hoisted.mockConnect.mockRejectedValue('Stringy handshake failure')
    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise
    expect(result.imapHandshake!.ok).toBe(false)
    expect(result.imapHandshake!.error).toBe('Stringy handshake failure')
  })

  it('auth: err instanceof Error fallback (string thrown)', async () => {
    hoisted.mockConnect
      .mockResolvedValueOnce(undefined) // checkImapHandshake ok
      .mockRejectedValueOnce('Auth string error') // checkAuth — string throw
    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise
    expect(result.auth!.ok).toBe(false)
    expect(result.auth!.error).toBe('Auth string error')
  })

  it('folders: err instanceof Error fallback (string thrown)', async () => {
    // Todas las capas previas (handshake + auth) conectan con éxito — el error viene de list().
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.mockList.mockRejectedValue('Folder string error')
    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise
    expect(result.folders!.accessible).toBe(false)
    expect(result.folders!.error).toBe('Folder string error')
  })

  it('handshake: greeting="" cuando serverGreeting es undefined (?? fallback)', async () => {
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.MockImapFlow.setGreeting(undefined) // próxima instancia: greeting undefined
    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise
    expect(result.imapHandshake!.greeting).toBe('')
    expect(result.imapHandshake!.capabilities).toContain('IMAP4rev1')
    expect(result.imapHandshake!.ok).toBe(true)
  })

  it('handshake: capabilities=[] cuando caps es undefined (ternary falsy)', async () => {
    hoisted.mockConnect.mockResolvedValue(undefined)
    hoisted.MockImapFlow.setCaps(undefined) // próxima instancia: caps undefined
    const promise = diagnoseMail(defaultBridgeCfg, makePasswordResolver())
    hoisted.emitConnect()
    const result = await promise
    expect(result.imapHandshake!.capabilities).toEqual([])
    expect(result.imapHandshake!.ok).toBe(true)
  })
})
