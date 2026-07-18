/**
 * Tests para src/ecosystem/installer.ts (7.69% → objetivo ~95%).
 *
 * Mockea:
 *  - node:child_process               → execFileSync (runApt)
 *  - ../which.js                       → Platform, Codename (getters mutables), whichSync
 *  - ./binaries.js                     → installationGuide
 *
 * Las constantes Platform / Codename de which.js se evalúan una sola vez
 * en el módulo real, pero al usar getters en vi.mock podemos mutar su
 * valor entre describe blocks o tests individuales.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BinaryInfo } from '../../src/ecosystem/binaries.js'

// ---------------------------------------------------------------------------
// vi.hoisted — shared state
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const mockExecFileSync = vi.fn()
  const mockWhichSync = vi.fn()

  // Mutable refs para Platform / Codename (getters abajo)
  const mockPlatform = { current: 'linux' }
  const mockCodename = { current: 'noble' }

  // Mock BinaryInfo para los 4 productos
  const bridgeInfo: BinaryInfo = {
    name: 'Proton Mail Bridge',
    product: 'bridge',
    defaultBin: 'protonmail-bridge-core',
    installUrl: 'https://proton.me/mail/bridge',
    versionCmd: ['--version'],
    envVar: 'PROTON_BRIDGE_USER',
    envPrefix: 'PROTON_BRIDGE',
  }

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

  const gpgInfo: BinaryInfo = {
    name: 'GnuPG',
    product: 'gpg',
    defaultBin: 'gpg',
    installUrl: 'https://gnupg.org/download/',
    versionCmd: ['--version'],
  }

  return {
    mockExecFileSync,
    mockWhichSync,
    mockPlatform,
    mockCodename,
    bridgeInfo,
    passInfo,
    driveInfo,
    gpgInfo,
  }
})

// ---------------------------------------------------------------------------
// vi.mock
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execFileSync: hoisted.mockExecFileSync,
}))

vi.mock('../../src/which.js', () => ({
  get Platform() {
    return hoisted.mockPlatform.current
  },
  get Codename() {
    return hoisted.mockCodename.current
  },
  whichSync: hoisted.mockWhichSync,
}))

vi.mock('../../src/ecosystem/binaries.js', () => ({
  installationGuide: vi.fn((product: string) => {
    if (product === 'bridge') {
      return {
        product: 'bridge',
        steps: [
          'Descarga Proton Mail Bridge desde https://proton.me/mail/bridge',
          'En Arch/EndeavourOS: sudo pacman -S protonmail-bridge-core',
          'En Debian/Ubuntu: instala el .deb oficial de Proton.',
          'Ejecuta: protonmail-bridge-core --cli → login → credenciales → exit',
        ],
      }
    }
    if (product === 'pass') {
      return {
        product: 'pass',
        steps: [
          'En Arch/EndeavourOS: sudo pacman -S pass',
          'En Debian/Ubuntu: sudo apt install pass',
          'En macOS: brew install pass',
          'Inicializa: gpg --gen-key && pass init <gpg-id>',
        ],
      }
    }
    if (product === 'drive') {
      return {
        product: 'drive',
        steps: [
          'Descarga el binario oficial proton-drive',
          'O usa el Dockerfile del proyecto',
        ],
      }
    }
    return { product, steps: ['Instala GnuPG desde https://gnupg.org/download/'] }
  }),
}))

// ---------------------------------------------------------------------------
// Módulo bajo test
// ---------------------------------------------------------------------------

import {
  installOnUbuntu,
  buildInstallPlan,
  platformPackage,
} from '../../src/ecosystem/installer.js'

// ---------------------------------------------------------------------------
// Reseteo entre tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.mockPlatform.current = 'linux'
  hoisted.mockCodename.current = 'noble'
})

// ===========================================================================
// installOnUbuntu
// ===========================================================================

describe('installOnUbuntu', () => {
  describe('product=pass', () => {
    it('ejecuta apt install pass gpg tree y devuelve ok=true cuando apt funciona', () => {
      hoisted.mockExecFileSync.mockReturnValue('') // apt success

      const result = installOnUbuntu(hoisted.passInfo)

      expect(result.ok).toBe(true)
      expect(result.product).toBe('tree')
      expect(result.message).toContain('Installed via apt')
      expect(hoisted.mockExecFileSync).toHaveBeenCalledWith(
        'sudo',
        ['apt', 'install', 'pass', 'gpg', 'tree', '-y'],
        expect.objectContaining({ encoding: 'utf-8', timeout: 120_000 }),
      )
    })

    it('devuelve ok=false con mensaje de error cuando apt falla', () => {
      hoisted.mockExecFileSync.mockImplementation(() => {
        throw new Error('E: Package tree has no installation candidate')
      })

      const result = installOnUbuntu(hoisted.passInfo)

      expect(result.ok).toBe(false)
      expect(result.message).toContain('E: Package tree has no installation candidate')
    })
  })

  describe('product=gpg', () => {
    it('ejecuta apt install gnupg2 y devuelve ok=true', () => {
      hoisted.mockExecFileSync.mockReturnValue('')

      const result = installOnUbuntu(hoisted.gpgInfo)

      expect(result.ok).toBe(true)
      expect(result.product).toBe('gnupg2')
      expect(result.message).toContain('Installed via apt install gnupg2')
      expect(hoisted.mockExecFileSync).toHaveBeenCalledWith(
        'sudo',
        ['apt', 'install', 'gnupg2', '-y'],
        expect.any(Object),
      )
    })

    it('devuelve ok=false cuando apt gnupg2 falla', () => {
      hoisted.mockExecFileSync.mockImplementation(() => {
        throw new Error('E: Unable to locate package gnupg2')
      })

      const result = installOnUbuntu(hoisted.gpgInfo)

      expect(result.ok).toBe(false)
      expect(result.message).toContain('E: Unable to locate package gnupg2')
    })
  })

  describe('product=drive', () => {
    it('devuelve steps de descarga manual (no llama apt)', () => {
      const result = installOnUbuntu(hoisted.driveInfo)

      expect(result.ok).toBe(false)
      expect(result.message).toContain('Descarga el binario proton-drive')
      expect(result.steps).toBeDefined()
      expect(result.steps!.length).toBeGreaterThanOrEqual(3)
      expect(result.steps![0]).toContain('wget')
      expect(result.steps![1]).toContain('chmod')
      // No debe llamar execFileSync (no apt)
      expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
    })
  })

  describe('product=bridge (fallback)', () => {
    it('devuelve steps con .deb y docker, usa Codename', () => {
      hoisted.mockCodename.current = 'jammy'

      const result = installOnUbuntu(hoisted.bridgeInfo)

      expect(result.ok).toBe(false)
      expect(result.product).toBe('bridge')
      expect(result.message).toContain('Bridge requiere instalación manual')
      expect(result.steps).toBeDefined()
      // Codename aparece en los steps
      const allSteps = result.steps!.join(' ')
      expect(allSteps).toContain('jammy')
      expect(allSteps).toContain('dpkg -i')
      expect(allSteps).toContain('docker compose')
      // No debe llamar apt
      expect(hoisted.mockExecFileSync).not.toHaveBeenCalled()
    })

    it('usa fallback "26.04" cuando Codename es undefined', () => {
      hoisted.mockCodename.current = undefined as unknown as string

      const result = installOnUbuntu(hoisted.bridgeInfo)

      const allSteps = result.steps!.join(' ')
      expect(allSteps).toContain('26.04')
    })
  })
})

// ===========================================================================
// buildInstallPlan
// ===========================================================================

describe('buildInstallPlan', () => {
  it('devuelve steps desde installationGuide para bridge', () => {
    const result = buildInstallPlan(hoisted.bridgeInfo)

    expect(result.product).toBe('bridge')
    expect(result.ok).toBe(false)
    expect(result.message).toContain('requires manual steps')
    expect(result.steps).toBeDefined()
    expect(result.steps!.length).toBeGreaterThanOrEqual(3)
    expect(result.steps![0]).toContain('Descarga Proton Mail Bridge')
  })

  it('devuelve steps para pass', () => {
    const result = buildInstallPlan(hoisted.passInfo)

    expect(result.product).toBe('pass')
    expect(result.steps!.some((s) => s.includes('sudo apt install pass'))).toBe(true)
  })
})

// ===========================================================================
// platformPackage
// ===========================================================================

describe('platformPackage', () => {
  describe('Platform=arch', () => {
    beforeEach(() => {
      hoisted.mockPlatform.current = 'arch'
    })

    it('bridge → protonmail-bridge-core', () => {
      expect(platformPackage(hoisted.bridgeInfo)).toBe('protonmail-bridge-core')
    })

    it('pass → pass', () => {
      expect(platformPackage(hoisted.passInfo)).toBe('pass')
    })

    it('gpg → gnupg', () => {
      expect(platformPackage(hoisted.gpgInfo)).toBe('gnupg')
    })

    it('drive → null (no mapeado)', () => {
      expect(platformPackage(hoisted.driveInfo)).toBeNull()
    })
  })

  describe('Platform=debian', () => {
    beforeEach(() => {
      hoisted.mockPlatform.current = 'debian'
    })

    it('pass → pass', () => {
      expect(platformPackage(hoisted.passInfo)).toBe('pass')
    })

    it('gpg → gnupg2', () => {
      expect(platformPackage(hoisted.gpgInfo)).toBe('gnupg2')
    })

    it('bridge → null (no mapeado)', () => {
      expect(platformPackage(hoisted.bridgeInfo)).toBeNull()
    })

    it('drive → null (no mapeado)', () => {
      expect(platformPackage(hoisted.driveInfo)).toBeNull()
    })
  })

  describe('Platform=macos', () => {
    beforeEach(() => {
      hoisted.mockPlatform.current = 'macos'
    })

    it('pass → pass', () => {
      expect(platformPackage(hoisted.passInfo)).toBe('pass')
    })

    it('gpg → gnupg', () => {
      expect(platformPackage(hoisted.gpgInfo)).toBe('gnupg')
    })

    it('bridge → null (no mapeado)', () => {
      expect(platformPackage(hoisted.bridgeInfo)).toBeNull()
    })

    it('drive → null (no mapeado)', () => {
      expect(platformPackage(hoisted.driveInfo)).toBeNull()
    })
  })

  describe('Platform=undefined (no detectada)', () => {
    beforeEach(() => {
      hoisted.mockPlatform.current = undefined as unknown as string
    })

    it('todos los productos → null', () => {
      expect(platformPackage(hoisted.bridgeInfo)).toBeNull()
      expect(platformPackage(hoisted.passInfo)).toBeNull()
      expect(platformPackage(hoisted.driveInfo)).toBeNull()
      expect(platformPackage(hoisted.gpgInfo)).toBeNull()
    })
  })
})
