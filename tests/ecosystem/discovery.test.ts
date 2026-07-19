/**
 * Tests para src/ecosystem/discovery.ts (7.33% → objetivo ~95%).
 *
 * Mockea:
 *  - node:child_process → execFileSync
 *  - node:fs → existsSync
 *  - ../which.js → whichSync
 *  - ./binaries.js → REGISTRY (mock de 3 productos)
 *
 * NOTA: parseHelpOutput tiene un bug en el primer pass:
 *   const trimmed = line.trim()
 *   if (!trimmed.startsWith('  ')) continue
 * Tras .trim() ninguna línea empieza con espacios, por lo que el
 * primer pass nunca produce resultados. El segundo pass (búsqueda
 * de "Commands:" header) es el que realmente funciona. Los tests
 * reflejan este comportamiento actual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { BinaryInfo } from '../../src/ecosystem/binaries.js'

// ---------------------------------------------------------------------------
// vi.hoisted — shared state para factories de vi.mock
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const mockExecFileSync = vi.fn()
  const mockExistsSync = vi.fn()
  const mockWhichSync = vi.fn()

  // Mock Registry (3 productos con distintas configs)
  const bridgeInfo: BinaryInfo = {
    name: 'Proton Mail Bridge',
    product: 'bridge',
    defaultBin: 'protonmail-bridge-core',
    installUrl: 'https://proton.me/mail/bridge',
    versionCmd: ['--version'],
    envVar: 'PROTON_BRIDGE_USER',
    envPrefix: 'PROTON_BRIDGE',
  }

  const driveInfo: BinaryInfo = {
    name: 'Proton Drive CLI',
    product: 'drive',
    defaultBin: 'proton-drive',
    installUrl: 'https://proton.me/support/drive-cli',
    versionCmd: ['--version'],
    healthCmd: ['auth', 'status'],
    envVar: 'DRIVE_CLI_BIN',
    envPrefix: 'DRIVE',
  }

  const gpgInfo: BinaryInfo = {
    name: 'GnuPG',
    product: 'gpg',
    defaultBin: 'gpg',
    installUrl: 'https://gnupg.org/download/',
    versionCmd: ['--version'],
  }

  const mockRegistry: BinaryInfo[] = [bridgeInfo, driveInfo, gpgInfo]

  return {
    mockExecFileSync,
    mockExistsSync,
    mockWhichSync,
    mockRegistry,
    bridgeInfo,
    driveInfo,
    gpgInfo,
  }
})

// ---------------------------------------------------------------------------
// vi.mock — módulos externos usados por discovery.ts
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execFileSync: hoisted.mockExecFileSync,
}))

vi.mock('node:fs', () => ({
  existsSync: hoisted.mockExistsSync,
}))

vi.mock('../../src/which.js', () => ({
  whichSync: hoisted.mockWhichSync,
}))

vi.mock('../../src/ecosystem/binaries.js', () => ({
  REGISTRY: hoisted.mockRegistry,
}))

// ---------------------------------------------------------------------------
// Módulo bajo test
// ---------------------------------------------------------------------------

import {
  resolveBinPath,
  checkBinary,
  checkAllBinaries,
  discoverSubcommands,
} from '../../src/ecosystem/discovery.js'

// ---------------------------------------------------------------------------
// Reseteo entre tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Restaurar registry por defecto (3 productos)
  hoisted.mockRegistry.length = 0
  hoisted.mockRegistry.push(hoisted.bridgeInfo, hoisted.driveInfo, hoisted.gpgInfo)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ===========================================================================
// resolveBinPath
// ===========================================================================

describe('resolveBinPath', () => {
  it('devuelve envPath cuando envVar existe y existsSync es true', () => {
    vi.stubEnv('PROTON_BRIDGE_USER', '/custom/path/bridge')
    hoisted.mockExistsSync.mockReturnValue(true)

    const result = resolveBinPath(hoisted.bridgeInfo)

    expect(result).toBe('/custom/path/bridge')
    // No debe llamar whichSync
    expect(hoisted.mockWhichSync).not.toHaveBeenCalled()
  })

  it('llama whichSync cuando el bin no tiene envVar', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/gpg')

    const result = resolveBinPath(hoisted.gpgInfo)

    expect(result).toBe('/usr/bin/gpg')
    expect(hoisted.mockWhichSync).toHaveBeenCalledWith('gpg')
  })

  it('falla a whichSync cuando envPath no existe en filesystem', () => {
    vi.stubEnv('PROTON_BRIDGE_USER', '/missing/bridge')
    hoisted.mockExistsSync.mockReturnValue(false)
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/protonmail-bridge-core')

    const result = resolveBinPath(hoisted.bridgeInfo)

    expect(result).toBe('/usr/bin/protonmail-bridge-core')
    expect(hoisted.mockWhichSync).toHaveBeenCalledWith('protonmail-bridge-core')
  })

  it('devuelve undefined cuando envPath no existe y whichSync lanza', () => {
    vi.stubEnv('PROTON_BRIDGE_USER', '/missing/bridge')
    hoisted.mockExistsSync.mockReturnValue(false)
    hoisted.mockWhichSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const result = resolveBinPath(hoisted.bridgeInfo)

    expect(result).toBeUndefined()
  })

  it('devuelve undefined cuando whichSync lanza y no hay envVar', () => {
    hoisted.mockWhichSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const result = resolveBinPath(hoisted.gpgInfo)

    expect(result).toBeUndefined()
  })

  it('trata envVar vacía como falsa y cae a whichSync', () => {
    vi.stubEnv('PROTON_BRIDGE_USER', '')
    hoisted.mockExistsSync.mockReturnValue(false)
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/protonmail-bridge-core')

    const result = resolveBinPath(hoisted.bridgeInfo)

    expect(result).toBe('/usr/bin/protonmail-bridge-core')
    expect(hoisted.mockWhichSync).toHaveBeenCalled()
  })
})

// ===========================================================================
// checkBinary
// ===========================================================================

describe('checkBinary', () => {
  it('devuelve no instalado cuando resolveBinPath es undefined', () => {
    hoisted.mockWhichSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const result = checkBinary(hoisted.gpgInfo)

    expect(result.installed).toBe(false)
    expect(result.inPath).toBe(false)
    expect(result.version).toBeUndefined()
    expect(result.error).toContain('gpg not found in PATH')
    // execFileSync no debe llamarse
    expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
  })

  it('parsea version cuando execFileSync versionCmd funciona (sin healthCmd)', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/gpg')
    hoisted.mockExecFileSync.mockReturnValue('gpg (GnuPG) 2.4.0\nCopyright ...\n')

    const result = checkBinary(hoisted.gpgInfo)

    expect(result.installed).toBe(true)
    expect(result.version).toBe('gpg (GnuPG) 2.4.0')
    expect(result.authenticated).toBeUndefined()
    expect(result.inPath).toBe(true)
    expect(result.path).toBe('/usr/bin/gpg')
    expect(hoisted.mockExecFileSync).toHaveBeenCalledWith(
      '/usr/bin/gpg',
      ['--version'],
      expect.objectContaining({ encoding: 'utf-8', timeout: 5000 }),
    )
  })

  it('version undefined cuando execFileSync versionCmd lanza', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/gpg')
    hoisted.mockExecFileSync.mockImplementation(() => {
      throw new Error('command not found')
    })

    const result = checkBinary(hoisted.gpgInfo)

    expect(result.installed).toBe(true)
    expect(result.version).toBeUndefined()
    expect(result.authenticated).toBeUndefined()
  })

  it('authenticated=true cuando healthCmd funciona', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/proton-drive')
    hoisted.mockExecFileSync
      .mockReturnValueOnce('proton-drive 1.0.0\n')         // versionCmd
      .mockReturnValueOnce('Authenticated as user@proton.me') // healthCmd

    const result = checkBinary(hoisted.driveInfo)

    expect(result.installed).toBe(true)
    expect(result.version).toBe('proton-drive 1.0.0')
    expect(result.authenticated).toBe(true)
    expect(hoisted.mockExecFileSync).toHaveBeenCalledTimes(2)
  })

  it('authenticated=false cuando healthCmd lanza', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/proton-drive')
    hoisted.mockExecFileSync
      .mockReturnValueOnce('proton-drive 1.0.0\n')         // versionCmd ok
      .mockImplementationOnce(() => {
        throw new Error('not authenticated')
      }) // healthCmd lanza

    const result = checkBinary(hoisted.driveInfo)

    expect(result.installed).toBe(true)
    expect(result.version).toBe('proton-drive 1.0.0')
    expect(result.authenticated).toBe(false)
  })
})

// ===========================================================================
// checkAllBinaries
// ===========================================================================

describe('checkAllBinaries', () => {
  it('devuelve resultados para cada item del REGISTRY', () => {
    // Los 3 items se resuelven correctamente
    hoisted.mockWhichSync
      .mockReturnValueOnce('/usr/bin/protonmail-bridge-core') // bridge
      .mockReturnValueOnce('/usr/bin/proton-drive')            // drive
      .mockReturnValueOnce('/usr/bin/gpg')                     // gpg
    hoisted.mockExecFileSync.mockReturnValue('1.0.0\n')

    const results = checkAllBinaries()

    expect(results).toHaveLength(3)
    expect(results[0].product).toBe('bridge')
    expect(results[1].product).toBe('drive')
    expect(results[2].product).toBe('gpg')
    // Todos instalados
    expect(results.every((r) => r.installed)).toBe(true)
  })

  it('devuelve array vacío cuando REGISTRY está vacío', () => {
    hoisted.mockRegistry.length = 0

    const results = checkAllBinaries()

    expect(results).toEqual([])
  })
})

// ===========================================================================
// discoverSubcommands (y parseHelpOutput internamente)
// ===========================================================================

describe('discoverSubcommands', () => {
  it('devuelve subcommands vacío cuando el binario no está instalado', () => {
    hoisted.mockWhichSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const result = discoverSubcommands(hoisted.gpgInfo)

    expect(result.version.installed).toBe(false)
    expect(result.subcommands).toEqual([])
    expect(result.rawHelp).toBe('')
  })

  it('parsea subcommands desde output de --help con sección "Commands:"', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/pass')
    hoisted.mockExecFileSync
      .mockReturnValueOnce('pass 1.7.4\n') // versionCmd (desde checkBinary)
      .mockReturnValueOnce([               // --help output
        'usage: pass [OPTIONS]',
        '',
        'Commands:',
        '  init   Initialize new password store',
        '  ls     List passwords',
        '  show   Show a password',
        '  generate   Generate a new password',
      ].join('\n'))

    const result = discoverSubcommands(hoisted.gpgInfo)

    expect(result.version.installed).toBe(true)
    expect(result.subcommands).toHaveLength(4)
    expect(result.subcommands[0]).toEqual({
      name: 'init',
      description: 'Initialize new password store',
    })
    expect(result.subcommands[1]).toEqual({
      name: 'ls',
      description: 'List passwords',
    })
    expect(result.subcommands[2]).toEqual({
      name: 'show',
      description: 'Show a password',
    })
    expect(result.subcommands[3]).toEqual({
      name: 'generate',
      description: 'Generate a new password',
    })
    expect(result.rawHelp).toContain('Commands:')
  })

  it('devuelve subcommands vacío cuando --help no contiene comandos', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/gpg')
    hoisted.mockExecFileSync
      .mockReturnValueOnce('gpg (GnuPG) 2.4.0\n') // versionCmd
      .mockReturnValueOnce(                        // --help sin comandos
        'gpg (GnuPG) 2.4.0\n' +
        'Copyright (C) 2024 Free Software Foundation, Inc.\n' +
        '\n' +
        'Supported algorithms:\n' +
        '  Pubkey: RSA, ELG, DSA, ECDH, ECDSA, EDDSA\n' +
        '  Cipher: IDEA, 3DES, CAST5, BLOWFISH, AES, AES192, AES256\n'
      )

    const result = discoverSubcommands(hoisted.gpgInfo)

    expect(result.version.installed).toBe(true)
    expect(result.subcommands).toEqual([])
    expect(result.rawHelp).toContain('Supported algorithms:')
  })

  it('devuelve subcommands vacío y rawHelp=empty cuando --help lanza', () => {
    hoisted.mockWhichSync.mockReturnValue('/usr/bin/proton-drive')
    hoisted.mockExecFileSync
      .mockReturnValueOnce('proton-drive 1.0.0\n') // versionCmd
      .mockImplementationOnce(() => {
        throw new Error('exec timeout')
      }) // --help lanza

    const result = discoverSubcommands(hoisted.gpgInfo)

    expect(result.version.installed).toBe(true)
    expect(result.subcommands).toEqual([])
    expect(result.rawHelp).toBe('')
  })
})
