/**
 * Tests unitarios para src/server/ecosystem.ts (17.5% cobertura).
 *
 * registerEcosystemTools registra 5 MCP tools:
 *  - proton_ecosystem_discover   → checkAllBinaries()
 *  - proton_ecosystem_health     → checkAllBinaries()
 *  - proton_ecosystem_check_updates → REGISTRY + checkUpdateFor()
 *  - proton_ecosystem_install    → getBinaryInfo() + buildInstallPlan()
 *
 * Estrategia de mocks:
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  vi.mock(discovery.js) → checkAllBinaries controlado     │
 *  │  vi.mock(binaries.js)  → REGISTRY + getBinaryInfo       │
 *  │  vi.mock(updater.js)   → checkUpdateFor                 │
 *  │  vi.mock(installer.js) → buildInstallPlan               │
 *  │  captureHandler        → registerTool intercept         │
 *  └─────────────────────────────────────────────────────────┘
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerEcosystemTools } from '../../src/server/ecosystem.js'

// ---------------------------------------------------------------------------
// vi.hoisted — shared state for vi.mock factories
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const mockCheckAllBinaries = vi.fn()
  const mockGetBinaryInfo = vi.fn()
  const mockCheckUpdateFor = vi.fn()
  const mockBuildInstallPlan = vi.fn()

  // BinaryInfo objects simulan el registro de productos
  const bridgeInfo = {
    name: 'Proton Mail Bridge',
    product: 'bridge',
    defaultBin: 'protonmail-bridge-core',
    envVar: undefined,
    versionCmd: ['--version'],
    healthCmd: undefined,
    downloadUrl: undefined,
  }
  const passInfo = {
    name: 'pass',
    product: 'pass',
    defaultBin: 'pass',
    envVar: 'PASS_STORE_DIR',
    versionCmd: ['version'],
    healthCmd: undefined,
    downloadUrl: undefined,
  }
  const driveInfo = {
    name: 'Proton Drive',
    product: 'drive',
    defaultBin: 'proton-drive',
    envVar: undefined,
    versionCmd: ['--version'],
    healthCmd: undefined,
    downloadUrl: undefined,
  }
  const mockRegistry = [bridgeInfo, passInfo, driveInfo]

  // BinaryVersion objects (resultados de checkAllBinaries)
  const bridgeVersion = {
    name: 'Proton Mail Bridge',
    product: 'bridge',
    installed: true,
    version: '3.24.0',
    authenticated: true,
    inPath: true,
    path: '/usr/bin/protonmail-bridge-core',
  }
  const passVersion = {
    name: 'pass',
    product: 'pass',
    installed: true,
    version: '1.7.4',
    authenticated: true,
    inPath: true,
    path: '/usr/bin/pass',
  }
  const driveVersion = {
    name: 'Proton Drive',
    product: 'drive',
    installed: false,
    inPath: false,
    error: 'proton-drive not found in PATH',
  }

  return {
    mockCheckAllBinaries,
    mockGetBinaryInfo,
    mockCheckUpdateFor,
    mockBuildInstallPlan,
    mockRegistry,
    bridgeInfo,
    passInfo,
    driveInfo,
    bridgeVersion,
    passVersion,
    driveVersion,
  }
})

// ---------------------------------------------------------------------------
// vi.mock — ecosystem dependencies
// ---------------------------------------------------------------------------

vi.mock('../../src/ecosystem/discovery.js', () => ({
  checkAllBinaries: hoisted.mockCheckAllBinaries,
}))

vi.mock('../../src/ecosystem/binaries.js', () => ({
  REGISTRY: hoisted.mockRegistry,
  getBinaryInfo: hoisted.mockGetBinaryInfo,
}))

vi.mock('../../src/ecosystem/updater.js', () => ({
  checkUpdateFor: hoisted.mockCheckUpdateFor,
}))

vi.mock('../../src/ecosystem/installer.js', () => ({
  buildInstallPlan: hoisted.mockBuildInstallPlan,
}))

// ---------------------------------------------------------------------------
// Logger silencioso
// ---------------------------------------------------------------------------

const silentLog = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

// ---------------------------------------------------------------------------
// Helper: captureHandler
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[]
    isError?: boolean
    structuredContent?: Record<string, unknown>
  }>

function captureHandler() {
  const handlers = new Map<string, ToolHandler>()
  const server = {
    registerTool: vi.fn((name: string, _schema: unknown, handler: ToolHandler) => {
      handlers.set(name, handler)
    }),
  } as unknown as McpServer
  return {
    server,
    invoke: async (toolName: string, args: Record<string, unknown> = {}) => {
      const handler = handlers.get(toolName)
      if (!handler) throw new Error(`Tool "${toolName}" not registered`)
      return handler(args)
    },
  }
}

// ---------------------------------------------------------------------------
// Reseteo entre tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// registerEcosystemTools
// ===========================================================================

describe('registerEcosystemTools', () => {
  // -------------------------------------------------------------------------
  // proton_ecosystem_discover
  // -------------------------------------------------------------------------

  describe('proton_ecosystem_discover', () => {
    it('devuelve markdown con todos los binarios', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([
        hoisted.bridgeVersion,
        hoisted.passVersion,
        hoisted.driveVersion,
      ])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_discover', {})
      const text = result.content[0].text

      expect(text).toContain('# Proton Ecosystem - Estado de binarios')
      expect(text).toContain('Proton Mail Bridge')
      expect(text).toContain('Instalado: si')
      expect(text).toContain('Version: 3.24.0')
      expect(text).toContain('Autenticado: si')
      expect(text).toContain('pass')
      expect(text).toContain('Version: 1.7.4')
      expect(text).toContain('Proton Drive')
      expect(text).toContain('Instalado: no')
      expect(text).toContain('Error: proton-drive not found')
      expect(hoisted.mockCheckAllBinaries).toHaveBeenCalledTimes(1)
    })

    it('devuelve JSON con response_format=json', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([
        hoisted.bridgeVersion,
        hoisted.passVersion,
        hoisted.driveVersion,
      ])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_discover', { response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(3)
      expect(parsed[0].product).toBe('bridge')
      expect(parsed[1].product).toBe('pass')
      expect(parsed[2].product).toBe('drive')
    })

    it('incluye structuredContent en json', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([hoisted.bridgeVersion])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_discover', { response_format: 'json' })
      expect(result.structuredContent).toBeDefined()
      const sc = result.structuredContent as { binaries: unknown[] }
      expect(sc.binaries).toHaveLength(1)
    })

    it('solo con binarios no instalados', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([
        { ...hoisted.driveVersion, product: 'bridge', name: 'Proton Mail Bridge' },
        hoisted.driveVersion,
        { ...hoisted.driveVersion, product: 'pass', name: 'pass' },
      ])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_discover', {})
      const text = result.content[0].text

      expect(text).toContain('Instalado: no')
      // Ningún "Instalado: si" debe aparecer
      expect(text).not.toContain('Instalado: si')
      // Ni versiones ni auth
      expect(text).not.toContain('Version:')
      expect(text).not.toContain('Autenticado:')
    })
  })

  // -------------------------------------------------------------------------
  // proton_ecosystem_health
  // -------------------------------------------------------------------------

  describe('proton_ecosystem_health', () => {
    it('devuelve markdown con healthy/unhealthy', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([
        hoisted.bridgeVersion,
        hoisted.passVersion,
        hoisted.driveVersion,
      ])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_health', {})
      const text = result.content[0].text

      expect(text).toContain('# Proton Ecosystem - Health')
      expect(text).toContain('Healthy: 2/3')
      expect(text).toContain('Proton Mail Bridge: ok')
      expect(text).toContain('pass: ok')
      expect(text).toContain('Proton Drive: missing')
    })

    it('marca como auth failed cuando authenticated=false', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([
        { ...hoisted.bridgeVersion, authenticated: false },
      ])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_health', {})
      const text = result.content[0].text

      expect(text).toContain('Healthy: 0/1')
      expect(text).toContain('Proton Mail Bridge: auth failed')
    })

    it('devuelve JSON con healthy/unhealthy arrays', async () => {
      hoisted.mockCheckAllBinaries.mockReturnValue([
        hoisted.bridgeVersion,
        hoisted.driveVersion,
        { ...hoisted.passVersion, authenticated: false },
      ])
      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_health', { response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.healthy).toHaveLength(1)  // solo bridge
      expect(parsed.healthy[0].product).toBe('bridge')
      expect(parsed.unhealthy).toHaveLength(2) // drive (not installed) + pass (auth failed)
      expect(result.structuredContent).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // proton_ecosystem_check_updates
  // -------------------------------------------------------------------------

  describe('proton_ecosystem_check_updates', () => {
    it('checkea todos los productos cuando no se filtra', async () => {
      hoisted.mockCheckUpdateFor
        .mockReturnValueOnce({ product: 'bridge', currentVersion: '3.24.0', latestVersion: '3.25.0', updatable: true })
        .mockReturnValueOnce({ product: 'pass', currentVersion: '1.7.4', latestVersion: '1.7.4', updatable: false })
        .mockReturnValueOnce({ product: 'drive', currentVersion: undefined, updatable: false, error: 'not installed' })

      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_check_updates', {})
      const text = result.content[0].text

      expect(text).toContain('# Proton Ecosystem Updates')
      expect(text).toContain('bridge: 3.24.0 → 3.25.0 [UPDATE]')
      expect(text).toContain('pass: 1.7.4 → 1.7.4 [OK]')
      expect(text).toContain('drive: N/A → ? [OK]')
      // checkUpdateFor llamado 3 veces (bridge, pass, drive)
      expect(hoisted.mockCheckUpdateFor).toHaveBeenCalledTimes(3)
    })

    it('filtra por producto específico (bridge)', async () => {
      hoisted.mockCheckUpdateFor
        .mockReturnValueOnce({ product: 'bridge', currentVersion: '3.24.0', latestVersion: '3.25.0', updatable: true })

      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_check_updates', { product: 'bridge' })
      const text = result.content[0].text

      expect(text).toContain('bridge: 3.24.0 → 3.25.0 [UPDATE]')
      // Solo bridge aparece
      expect(text).not.toContain('pass')
      expect(text).not.toContain('drive')
      expect(hoisted.mockCheckUpdateFor).toHaveBeenCalledTimes(1)
    })

    it('filtra por drive (sin actualización disponible)', async () => {
      hoisted.mockCheckUpdateFor
        .mockReturnValueOnce({ product: 'drive', currentVersion: undefined, updatable: false, error: 'not installed' })

      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_check_updates', { product: 'drive' })
      const text = result.content[0].text

      expect(text).toContain('drive: N/A → ? [OK]')
      expect(hoisted.mockCheckUpdateFor).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // proton_ecosystem_install
  // -------------------------------------------------------------------------

  describe('proton_ecosystem_install', () => {
    it('devuelve plan de instalación para producto conocido', async () => {
      hoisted.mockGetBinaryInfo.mockReturnValue({
        name: 'Proton Drive',
        product: 'drive',
        defaultBin: 'proton-drive',
        envVar: undefined,
        versionCmd: ['--version'],
        healthCmd: undefined,
        downloadUrl: undefined,
      })
      hoisted.mockBuildInstallPlan.mockReturnValue({
        product: 'drive',
        ok: false,
        message: 'Installation of Proton Drive requires manual steps',
        steps: [
          'wget -q https://proton.me/download/drive/cli/linux/proton-drive -O /usr/local/bin/proton-drive',
          'chmod +x /usr/local/bin/proton-drive',
        ],
      })

      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_install', { product: 'drive' })
      const text = result.content[0].text

      expect(text).toContain('# Installing Proton Drive')
      expect(text).toContain('wget -q')
      expect(text).toContain('chmod +x')
      expect(hoisted.mockGetBinaryInfo).toHaveBeenCalledWith('drive')
      expect(hoisted.mockBuildInstallPlan).toHaveBeenCalled()
    })

    it('devuelve isError para producto desconocido', async () => {
      hoisted.mockGetBinaryInfo.mockReturnValue(undefined)

      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      const result = await invoke('proton_ecosystem_install', { product: 'gpg' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown product')
      expect(hoisted.mockBuildInstallPlan).not.toHaveBeenCalled()
    })

    it('instala drive cuando product=drive (producto por defecto en schema Zod)', async () => {
      hoisted.mockGetBinaryInfo.mockReturnValue({
        name: 'Proton Drive',
        product: 'drive',
        defaultBin: 'proton-drive',
      })
      hoisted.mockBuildInstallPlan.mockReturnValue({
        product: 'drive',
        ok: false,
        message: '',
        steps: [],
      })

      const { server, invoke } = captureHandler()
      registerEcosystemTools(server, { log: silentLog })

      // Nota: Zod.default() se aplica en la capa MCP, no en el handler.
      // Pasamos product explícitamente porque invocamos el handler directo.
      await invoke('proton_ecosystem_install', { product: 'drive' })
      expect(hoisted.mockGetBinaryInfo).toHaveBeenCalledWith('drive')
      expect(hoisted.mockBuildInstallPlan).toHaveBeenCalled()
    })
  })
})
