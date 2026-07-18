/**
 * Tests para src/server/drive.ts (59.93% → objetivo ~95%).
 *
 * registerDriveTools registra 12 MCP tools.
 * Mockea DriveClient, DriveAuditor, node:fs (existsSync/mkdirSync/renameSync).
 * Usa captureHandler para interceptar registerTool.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerDriveTools } from '../../src/server/drive.js'

const hoisted = vi.hoisted(() => {
  // DriveClient mocks
  const mockStatus = vi.fn()
  const mockListFiles = vi.fn()
  const mockDownload = vi.fn()
  const mockUpload = vi.fn()
  const mockShare = vi.fn()
  const mockMoveFiles = vi.fn()
  const mockCopyFiles = vi.fn()
  const mockMkdir = vi.fn()
  const mockRemoveFiles = vi.fn()

  const mockDriveClient = {
    status: mockStatus,
    listFiles: mockListFiles,
    download: mockDownload,
    upload: mockUpload,
    share: mockShare,
    moveFiles: mockMoveFiles,
    copyFiles: mockCopyFiles,
    mkdir: mockMkdir,
    removeFiles: mockRemoveFiles,
    stagingDir: '/tmp/staging',
  }

  // DriveAuditor mocks
  const mockScanInventory = vi.fn()
  const mockFindDuplicates = vi.fn()
  const mockFormatReport = vi.fn()
  const mockBuildOrganizePlan = vi.fn()

  const mockAuditor = {
    scanInventory: mockScanInventory,
    findDuplicates: mockFindDuplicates,
    formatReport: mockFormatReport,
    buildOrganizePlan: mockBuildOrganizePlan,
  }

  // Mock node:fs
  const mockExistsSync = vi.fn()
  const mockMkdirSync = vi.fn()
  const mockRenameSync = vi.fn()

  const silentLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }

  return {
    mockDriveClient, mockAuditor, silentLog,
    mockStatus, mockListFiles, mockDownload, mockUpload, mockShare,
    mockMoveFiles, mockCopyFiles, mockMkdir, mockRemoveFiles,
    mockScanInventory, mockFindDuplicates, mockFormatReport, mockBuildOrganizePlan,
    mockExistsSync, mockMkdirSync, mockRenameSync,
  }
})

vi.mock('../../src/drive.js', () => ({
  DriveClient: vi.fn(() => hoisted.mockDriveClient),
}))

vi.mock('../../src/drive-audit.js', () => ({
  DriveAuditor: vi.fn(() => hoisted.mockAuditor),
}))

vi.mock('node:fs', () => ({
  existsSync: hoisted.mockExistsSync,
  mkdirSync: hoisted.mockMkdirSync,
  renameSync: hoisted.mockRenameSync,
}))

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const driveEnabledCfg = {
  products: {
    drive: { enabled: true, stagingDir: '/tmp/staging', obsoleteExtensions: ['.doc', '.xls'] },
  },
} as never

const driveDisabledCfg = {
  products: {
    drive: { enabled: false },
  },
} as never

// ---------------------------------------------------------------------------
// Helpers
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

function register(server: McpServer) {
  registerDriveTools(server, { cfg: driveEnabledCfg, log: hoisted.silentLog, driveClient: hoisted.mockDriveClient as never })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// registerDriveTools
// ===========================================================================

describe('registerDriveTools', () => {
  it('no registra tools cuando drive no está enabled', () => {
    const { server } = captureHandler()
    registerDriveTools(server, { cfg: driveDisabledCfg, log: hoisted.silentLog, driveClient: undefined as never })
    expect((server as { registerTool: ReturnType<typeof vi.fn> }).registerTool).not.toHaveBeenCalled()
  })

  it('registra 12 tools cuando drive está enabled', () => {
    const { server } = captureHandler()
    register(server)
    const toolNames = (server as { registerTool: ReturnType<typeof vi.fn> }).registerTool.mock.calls.map((c: [string]) => c[0])
    expect(toolNames).toContain('proton_drive_audit')
    expect(toolNames).toContain('proton_drive_status')
    expect(toolNames).toContain('proton_drive_organize')
    expect(toolNames).toContain('proton_drive_format_report')
    expect(toolNames).toContain('proton_drive_list_files')
    expect(toolNames).toContain('proton_drive_download')
    expect(toolNames).toContain('proton_drive_upload')
    expect(toolNames).toContain('proton_drive_share')
    expect(toolNames).toContain('proton_drive_move')
    expect(toolNames).toContain('proton_drive_copy')
    expect(toolNames).toContain('proton_drive_create_folder')
    expect(toolNames).toContain('proton_drive_remove')
  })

  // -----------------------------------------------------------------------
  // proton_drive_audit
  // -----------------------------------------------------------------------

  describe('proton_drive_audit', () => {
    it('devuelve markdown con inventario', async () => {
      hoisted.mockScanInventory.mockReturnValue({ totalFiles: 10, totalBytes: 2048000, byExt: { '.txt': 5, '.jpg': 5 } })
      hoisted.mockFindDuplicates.mockReturnValue([{ hash: 'abc123', size: 100, files: [{ path: 'a.txt', name: 'a.txt' }, { path: 'b.txt', name: 'b.txt' }] }])
      hoisted.mockFormatReport.mockReturnValue({ obsoleteFiles: [] })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_audit', {})
      expect(result.content[0].text).toContain('Proton Drive Audit')
      expect(result.content[0].text).toContain('10 files')
      expect(result.content[0].text).toContain('2.0 MB')
      expect(result.content[0].text).toContain('.txt')
      expect(result.content[0].text).toContain('abc123')
    })

    it('devuelve JSON con structuredContent', async () => {
      hoisted.mockScanInventory.mockReturnValue({ totalFiles: 5, totalBytes: 1000, byExt: {} })
      hoisted.mockFindDuplicates.mockReturnValue([])
      hoisted.mockFormatReport.mockReturnValue({ obsoleteFiles: [] })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_audit', { response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.totalFiles).toBe(5)
      expect(result.structuredContent).toBeDefined()
    })

    it('devuelve isError cuando scanInventory lanza', async () => {
      hoisted.mockScanInventory.mockImplementation(() => { throw new Error('ENOENT: staging dir missing') })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_audit', {})
      expect(result.isError).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // proton_drive_status
  // -----------------------------------------------------------------------

  describe('proton_drive_status', () => {
    it('devuelve markdown con estado', async () => {
      hoisted.mockStatus.mockResolvedValue({
        ok: true, configured: true, authenticated: true,
        stagingExists: true, stagingFiles: 15, stagingBytes: 5000000,
        cliPath: '/usr/bin/proton-drive',
      })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_status', {})
      expect(result.content[0].text).toContain('Proton Drive Status')
      expect(result.content[0].text).toContain('/usr/bin/proton-drive')
      expect(result.content[0].text).toContain('yes')
      expect(result.content[0].text).toContain('15')
    })

    it('devuelve JSON con structuredContent', async () => {
      hoisted.mockStatus.mockResolvedValue({ ok: true, configured: true, authenticated: true, stagingExists: false, cliPath: '/usr/bin/proton-drive' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_status', { response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.ok).toBe(true)
      expect(result.structuredContent).toBeDefined()
    })

    it('devuelve isError cuando status lanza', async () => {
      hoisted.mockStatus.mockRejectedValue(new Error('CLI not found'))
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_status', {})
      expect(result.isError).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // proton_drive_organize
  // -----------------------------------------------------------------------

  describe('proton_drive_organize', () => {
    it('devuelve plan en dry-run sin mover archivos', async () => {
      hoisted.mockBuildOrganizePlan.mockReturnValue({
        suggestions: [
          { from: 'report.doc', to: 'Archive/report.doc', reason: 'Obsolete format', action: 'move' },
        ],
      })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_organize', { dry_run: true })
      expect(result.content[0].text).toContain('dry-run')
      expect(result.content[0].text).toContain('report.doc')
      expect(result.content[0].text).toContain('Archive/report.doc')
      expect(hoisted.mockRenameSync).not.toHaveBeenCalled()
    })

    it('mueve archivos cuando dry_run=false', async () => {
      hoisted.mockBuildOrganizePlan.mockReturnValue({
        suggestions: [
          { from: 'old.doc', to: 'Archive/old.doc', reason: 'obsolete', action: 'move' },
        ],
      })
      hoisted.mockExistsSync.mockReturnValue(false)
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_organize', { dry_run: false })
      expect(result.content[0].text).toContain('Moved 1 files')
      expect(hoisted.mockMkdirSync).toHaveBeenCalled()
      expect(hoisted.mockRenameSync).toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // proton_drive_format_report
  // -----------------------------------------------------------------------

  describe('proton_drive_format_report', () => {
    it('devuelve markdown con extensiones y archivos obsoletos', async () => {
      hoisted.mockFormatReport.mockReturnValue({
        totalExtensions: 3, obsoleteFiles: [{ path: 'old.doc', ext: '.doc', name: 'old.doc', size: 5000 }],
        noExtension: 1, extensions: ['.txt', '.doc', ''],
      })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_format_report', {})
      expect(result.content[0].text).toContain('3')
      expect(result.content[0].text).toContain('old.doc')
      expect(result.content[0].text).toContain('.txt')
    })

    it('devuelve JSON', async () => {
      hoisted.mockFormatReport.mockReturnValue({ totalExtensions: 0, obsoleteFiles: [], noExtension: 0, extensions: [] })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_format_report', { response_format: 'json' })
      expect(result.structuredContent).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // proton_drive_list_files
  // -----------------------------------------------------------------------

  describe('proton_drive_list_files', () => {
    it('devuelve markdown con lista de archivos', async () => {
      hoisted.mockListFiles.mockResolvedValue({
        ok: true, files: [{ name: 'doc.txt', size: 100 }, { name: 'image.jpg', size: 50000 }], raw: '',
      })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_list_files', { remote_path: '/my-files' })
      expect(result.content[0].text).toContain('doc.txt')
      expect(result.content[0].text).toContain('100 bytes')
      expect(result.content[0].text).toContain('2')
    })

    it('devuelve isError cuando listFiles.ok=false', async () => {
      hoisted.mockListFiles.mockResolvedValue({ ok: false, files: [], raw: '', error: 'permission denied' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_list_files', { remote_path: '/bad' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('permission denied')
    })
  })

  // -----------------------------------------------------------------------
  // proton_drive_download / upload / share
  // -----------------------------------------------------------------------

  describe('proton_drive_download', () => {
    it('descarga y devuelve ruta', async () => {
      hoisted.mockDownload.mockResolvedValue({ ok: true, remotePath: '/r', localPath: '/l' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_download', { remote_path: '/remote' })
      expect(result.content[0].text).toContain('/r')
      expect(result.content[0].text).toContain('/l')
    })

    it('devuelve isError cuando download.ok=false', async () => {
      hoisted.mockDownload.mockResolvedValue({ ok: false, remotePath: '/r', localPath: '/l', error: 'fail' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_download', { remote_path: '/bad' })
      expect(result.isError).toBe(true)
    })
  })

  describe('proton_drive_upload', () => {
    it('sube y devuelve ruta', async () => {
      hoisted.mockUpload.mockResolvedValue({ ok: true, localPath: '/l', remotePath: '/r' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_upload', {})
      expect(result.content[0].text).toContain('/l')
      expect(result.content[0].text).toContain('/r')
    })
  })

  describe('proton_drive_share', () => {
    it('comparte y devuelve email', async () => {
      hoisted.mockShare.mockResolvedValue({ ok: true, remotePath: '/r', userEmail: 'user@test.com' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_share', { remote_path: '/r', user_email: 'user@test.com' })
      expect(result.content[0].text).toContain('user@test.com')
    })
  })

  // -----------------------------------------------------------------------
  // proton_drive_move / copy / create_folder / remove
  // -----------------------------------------------------------------------

  describe('proton_drive_move', () => {
    it('mueve y devuelve flecha', async () => {
      hoisted.mockMoveFiles.mockResolvedValue({ ok: true })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_move', { from: '/a', to: '/b' })
      expect(result.content[0].text).toContain('→')
    })

    it('devuelve isError cuando moveFiles.ok=false', async () => {
      hoisted.mockMoveFiles.mockResolvedValue({ ok: false, error: 'not found' })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_move', { from: '/a', to: '/b' })
      expect(result.isError).toBe(true)
    })
  })

  describe('proton_drive_copy', () => {
    it('copia y devuelve flecha', async () => {
      hoisted.mockCopyFiles.mockResolvedValue({ ok: true })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_copy', { from: '/s', to: '/d' })
      expect(result.content[0].text).toContain('→')
    })
  })

  describe('proton_drive_create_folder', () => {
    it('crea directorio y devuelve confirmación', async () => {
      hoisted.mockMkdir.mockResolvedValue({ ok: true })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_create_folder', { remote_path: '/new/folder' })
      expect(result.content[0].text).toContain('Created folder')
    })
  })

  describe('proton_drive_remove', () => {
    it('elimina y devuelve confirmación', async () => {
      hoisted.mockRemoveFiles.mockResolvedValue({ ok: true })
      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_drive_remove', { remote_path: '/old/file' })
      expect(result.content[0].text).toContain('Removed')
    })
  })
})
