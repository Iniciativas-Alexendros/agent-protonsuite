/**
 * Tests para src/ecosystem/updater.ts (5.35% → objetivo ~95%).
 *
 * Mockea:
 *  - node:child_process           → execFileSync (getPackageManager + apt policy)
 *  - ../ecosystem/discovery.js    → checkBinary
 *
 * Funciones privadas (probadas a través de checkUpdateFor):
 *  - fetchLatestVersion(bin)      → switch por producto
 *  - getPackageManager()          → apt → pacman → brew
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BinaryInfo } from '../../src/ecosystem/binaries.js'

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const mockExecFileSync = vi.fn()
  const mockCheckBinary = vi.fn()

  // BinaryInfo para los 4 productos
  const passInfo: BinaryInfo = {
    name: 'pass (password-store)',
    product: 'pass',
    defaultBin: 'pass',
    installUrl: 'https://www.passwordstore.org/',
    versionCmd: ['--version'],
    envVar: 'PASSWORD_STORE_DIR',
    envPrefix: 'PROTON_PASS',
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

  const bridgeInfo: BinaryInfo = {
    name: 'Proton Mail Bridge',
    product: 'bridge',
    defaultBin: 'protonmail-bridge-core',
    installUrl: 'https://proton.me/mail/bridge',
    versionCmd: ['--version'],
    envVar: 'PROTON_BRIDGE_USER',
    envPrefix: 'PROTON_BRIDGE',
  }

  const gpgInfo: BinaryInfo = {
    name: 'GnuPG',
    product: 'gpg',
    defaultBin: 'gpg',
    installUrl: 'https://gnupg.org/download/',
    versionCmd: ['--version'],
  }

  return {
    mockExecFileSync,
    mockCheckBinary,
    passInfo,
    driveInfo,
    bridgeInfo,
    gpgInfo,
  }
})

// ---------------------------------------------------------------------------
// vi.mock
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execFileSync: hoisted.mockExecFileSync,
}))

vi.mock('../../src/ecosystem/discovery.js', () => ({
  checkBinary: hoisted.mockCheckBinary,
}))

// ---------------------------------------------------------------------------
// Módulo bajo test
// ---------------------------------------------------------------------------

import { checkUpdateFor } from '../../src/ecosystem/updater.js'

// ---------------------------------------------------------------------------
// Reseteo
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// checkUpdateFor
// ===========================================================================

describe('checkUpdateFor', () => {
  // -------------------------------------------------------------------------
  // Sin instalación — checkBinary falla
  // -------------------------------------------------------------------------

  it('not installed → updatable=false, error del binario', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: false,
      version: undefined,
      error: 'pass not found in PATH',
    })

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.product).toBe('pass')
    expect(result.updatable).toBe(false)
    expect(result.error).toBe('pass not found in PATH')
    expect(result.currentVersion).toBeUndefined()
    expect(result.latestVersion).toBeUndefined()
    // No debe llamar execFileSync (early return)
    expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
  })

  it('installed=true pero sin version → updatable=false, error="not installed"', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: undefined,
      // error no definido → fallback 'not installed'
    })

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(false)
    expect(result.error).toBe('not installed')
  })

  // -------------------------------------------------------------------------
  // Productos que no necesitan fetch — drive, gpg, bridge
  // -------------------------------------------------------------------------

  it('product=drive → latestVersion=undefined, updatable=false', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '1.0.0',
    })

    const result = checkUpdateFor(hoisted.driveInfo)

    expect(result.product).toBe('drive')
    expect(result.currentVersion).toBe('1.0.0')
    expect(result.latestVersion).toBeUndefined()
    expect(result.updatable).toBe(false)
    expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
  })

  it('product=gpg → latestVersion=undefined, updatable=false', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '2.4.0',
    })

    const result = checkUpdateFor(hoisted.gpgInfo)

    expect(result.product).toBe('gpg')
    expect(result.latestVersion).toBeUndefined()
    expect(result.updatable).toBe(false)
    expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
  })

  it('product=bridge → latestVersion=undefined, updatable=false', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '3.24.0',
    })

    const result = checkUpdateFor(hoisted.bridgeInfo)

    expect(result.product).toBe('bridge')
    expect(result.latestVersion).toBeUndefined()
    expect(result.updatable).toBe(false)
    expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // product=pass — apt disponible
  // -------------------------------------------------------------------------

  it('product=pass, apt disponible, version nueva → updatable=true', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '1.7.4',
    })
    // execFileSync secuencia: apt --version ok, luego cache policy pass
    hoisted.mockExecFileSync
      .mockReturnValueOnce('')                           // apt --version
      .mockReturnValueOnce('  Installed: 1.7.4\n  Candidato: 2.0.0-1\n') // cache policy

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(true)
    expect(result.currentVersion).toBe('1.7.4')
    expect(result.latestVersion).toBe('2.0.0-1')
    // getPackageManager llamó apt, fetchLatestVersion llamó cache policy
    expect(hoisted.mockExecFileSync).toHaveBeenCalledTimes(2)
    expect(hoisted.mockExecFileSync).toHaveBeenNthCalledWith(
      1, 'apt', ['--version'], expect.objectContaining({ encoding: 'utf-8', timeout: 3000 }),
    )
    expect(hoisted.mockExecFileSync).toHaveBeenNthCalledWith(
      2, 'apt', ['cache', 'policy', 'pass'], expect.objectContaining({ encoding: 'utf-8', timeout: 10_000 }),
    )
  })

  it('product=pass, apt disponible, misma version → updatable=false', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '2.0.0-1',
    })
    hoisted.mockExecFileSync
      .mockReturnValueOnce('')                           // apt --version
      .mockReturnValueOnce('  Installed: 1.7.4\n  Candidato: 2.0.0-1\n') // misma version

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(false)
    expect(result.currentVersion).toBe('2.0.0-1')
    expect(result.latestVersion).toBe('2.0.0-1')
  })

  it('product=pass, apt disponible, cache policy sin "Candidato:" → latestVersion=undefined', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '1.7.4',
    })
    hoisted.mockExecFileSync
      .mockReturnValueOnce('')                           // apt --version
      .mockReturnValueOnce('  pass: Installed: 1.7.4\n') // sin línea Candidate

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(false)
    expect(result.latestVersion).toBeUndefined()
  })

  it('product=pass, apt disponible, cache policy lanza → latestVersion=undefined', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '1.7.4',
    })
    hoisted.mockExecFileSync
      .mockReturnValueOnce('')                           // apt --version ok
      .mockImplementationOnce(() => {
        throw new Error('apt cache error')
      }) // cache policy lanza

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(false)
    expect(result.latestVersion).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // product=pass — getPackageManager fallbacks
  // -------------------------------------------------------------------------

  it('product=pass, apt no disponible, pacman si → usa pacman para cache policy', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '1.7.4',
    })
    hoisted.mockExecFileSync
      .mockImplementationOnce(() => { throw new Error('apt not found') }) // apt --version fail
      .mockReturnValueOnce('')                                           // pacman --version ok
      .mockReturnValueOnce('  Candidato: 1.8.0-1\n')                    // pacman cache policy

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(true)
    expect(result.latestVersion).toBe('1.8.0-1')
    // 3 llamadas: apt fail, pacman ok, cache policy
    expect(hoisted.mockExecFileSync).toHaveBeenCalledTimes(3)
  })

  it('product=pass, ni apt ni pacman disponibles → brew fallback', () => {
    hoisted.mockCheckBinary.mockReturnValue({
      installed: true,
      version: '1.7.4',
    })
    hoisted.mockExecFileSync
      .mockImplementationOnce(() => { throw new Error('apt not found') })  // apt fail
      .mockImplementationOnce(() => { throw new Error('pacman not found') }) // pacman fail
      .mockReturnValueOnce('  Candidato: 2.0.0\n')                          // brew cache policy

    const result = checkUpdateFor(hoisted.passInfo)

    expect(result.updatable).toBe(true)
    expect(result.latestVersion).toBe('2.0.0')
    // 3 llamadas: apt fail, pacman fail, brew cache policy
    expect(hoisted.mockExecFileSync).toHaveBeenCalledTimes(3)
    // Última llamada debe ser a 'brew'
    expect(hoisted.mockExecFileSync).toHaveBeenNthCalledWith(
      3, 'brew', ['cache', 'policy', 'pass'], expect.any(Object),
    )
  })
})
