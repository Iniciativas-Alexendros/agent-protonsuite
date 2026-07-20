import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import {
  parseGoal,
  describeGoal,
  buildGoalContext,
  runAgent,
} from '../src/agent/index.js'
import type { GoalContext } from '../src/agent/index.js'

// Mock setup module for discover/setup/pass-audit goals — no I/O real
vi.mock('../src/agent/setup.js', () => ({
  runSetup: vi.fn(),
}))
import { runSetup } from '../src/agent/setup.js'

// Mock DriveClient for executor drive goal tests
const mockDriveClient = {
  stagingDir: '/tmp/staging',
  listFiles: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}

vi.mock('../src/drive.js', () => ({
  DriveClient: vi.fn().mockImplementation(() => mockDriveClient),
}))

describe('agent goals', () => {
  it('parses known goals', () => {
    expect(parseGoal('discover')).toBe('discover')
    expect(parseGoal('setup')).toBe('setup')
    expect(parseGoal('organize')).toBe('organize')
    expect(parseGoal('monitor')).toBe('monitor')
    expect(parseGoal('alert')).toBe('alert')
  })

  it('defaults to setup', () => {
    expect(parseGoal(undefined)).toBe('setup')
  })

  it('parses drive goals', () => {
    expect(parseGoal('drive-audit')).toBe('drive-audit')
    expect(parseGoal('drive-organize')).toBe('drive-organize')
    expect(parseGoal('drive-list')).toBe('drive-list')
    expect(parseGoal('drive-download')).toBe('drive-download')
    expect(parseGoal('drive-upload')).toBe('drive-upload')
  })

  it('rejects unknown goals', () => {
    expect(() => parseGoal('delete')).toThrow(/Unknown agent goal/)
  })

  it('describes goals in Spanish', () => {
    expect(describeGoal('discover')).toContain('Descubre')
    expect(describeGoal('organize')).toContain('Analiza')
  })

  it('builds goal context from config', () => {
    const ctx = buildGoalContext('organize', {
      dryRun: true,
      maxInspectEmails: 42,
      minConfidence: 0.5,
    })
    const expected: GoalContext = {
      goal: 'organize',
      dryRun: true,
      maxInspectEmails: 42,
      minConfidence: 0.5,
    }
    expect(ctx).toEqual(expected)
  })

  it('drive-audit goal exits 2 when DRIVE_ENABLED is false', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const prevEnabled = process.env.DRIVE_ENABLED
    process.env.DRIVE_ENABLED = 'false'
    // Provide minimal valid mail config so loadConfig() passes and the
    // drive gate (not config validation) is the path exercised.
    const validEmail = 'test' + '@' + 'example.com'
    const prevUser = process.env.PROTON_BRIDGE_USER
    const prevPass = process.env.PROTON_BRIDGE_PASS
    const prevFrom = process.env.PROTON_MAIL_FROM
    process.env.PROTON_BRIDGE_USER = validEmail
    process.env.PROTON_BRIDGE_PASS = 'secret'
    process.env.PROTON_MAIL_FROM = validEmail
    try {
      await runAgent('drive-audit')
    } catch {
      // runAgent may throw after exit is mocked; ignore
    }
    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
    if (prevEnabled === undefined) delete process.env.DRIVE_ENABLED
    else process.env.DRIVE_ENABLED = prevEnabled
    if (prevUser === undefined) delete process.env.PROTON_BRIDGE_USER
    else process.env.PROTON_BRIDGE_USER = prevUser
    if (prevPass === undefined) delete process.env.PROTON_BRIDGE_PASS
    else process.env.PROTON_BRIDGE_PASS = prevPass
    if (prevFrom === undefined) delete process.env.PROTON_MAIL_FROM
    else process.env.PROTON_MAIL_FROM = prevFrom
  })
})

// ===========================================================================
// executor.ts — drive goals (Branch Hunt 2)
// ===========================================================================

describe('executor drive goals', () => {
  const OENV = { ...process.env }

  beforeAll(() => {
    // Set env vars so loadConfig() produces a valid config with drive enabled
    process.env.DRIVE_ENABLED = 'true'
    process.env.DRIVE_CLI_BIN = '/usr/bin/proton-drive'
    process.env.DRIVE_STAGING_DIR = '/tmp/staging'
    process.env.PROTON_BRIDGE_USER = 'test@example.com'
    process.env.PROTON_BRIDGE_PASS = 'secret'
    process.env.PROTON_MAIL_FROM = 'test@example.com'
  })

  afterAll(() => {
    Object.assign(process.env, OENV)
    for (const k of Object.keys(OENV)) {
      if (!(k in OENV)) delete process.env[k]
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('drive-list goal exits 2 when list fails', async () => {
    mockDriveClient.listFiles.mockResolvedValue({ ok: false, files: [], error: 'not found' })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    try {
      await runAgent('drive-list')
    } catch {
      // ignored — exit is mocked
    }
    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
  })

  it('drive-list goal succeeds when list returns files', async () => {
    mockDriveClient.listFiles.mockResolvedValue({ ok: true, files: [{ name: 'a.txt', size: 100 }] })
    await expect(runAgent('drive-list')).resolves.toBeUndefined()
  })

  it('drive-upload goal exits 2 when upload fails', async () => {
    mockDriveClient.upload.mockResolvedValue({ ok: false, error: 'quota exceeded' })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    try {
      await runAgent('drive-upload')
    } catch {
      // ignored — exit is mocked
    }
    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
  })

  it('drive-upload goal succeeds when upload completes', async () => {
    mockDriveClient.upload.mockResolvedValue({ ok: true, localPath: '/tmp/staging', remotePath: '/my-files' })
    await expect(runAgent('drive-upload')).resolves.toBeUndefined()
  })

  it('suite-manage goal executes without error', async () => {
    // This goal discovers binaries — should run without exiting
    await expect(runAgent('suite-manage')).resolves.toBeUndefined()
  })
})

// ===========================================================================
// executor.ts — setup/discover/pass-audit goals (Branch Hunt 2)
// ===========================================================================

describe('executor setup goals', () => {
  const OENV = { ...process.env }

  beforeAll(() => {
    // Set env vars so loadConfig() produces a valid config
    process.env.PROTON_BRIDGE_USER = 'test@example.com'
    process.env.PROTON_BRIDGE_PASS = 'secret'
    process.env.PROTON_MAIL_FROM = 'test@example.com'
  })

  afterAll(() => {
    Object.assign(process.env, OENV)
    for (const k of Object.keys(OENV)) {
      if (!(k in OENV)) delete process.env[k]
    }
  })

  it('discover goal logs report without exiting', async () => {
    const mockRunSetup = vi.mocked(runSetup)
    mockRunSetup.mockResolvedValue({
      imapOk: true,
      smtpOk: true,
      folders: ['INBOX', 'Sent'],
      recommendations: [],
    })

    await expect(runAgent('discover')).resolves.toBeUndefined()
    expect(mockRunSetup).toHaveBeenCalledTimes(1)
  })

  it('setup goal logs success when imap and smtp ok', async () => {
    const mockRunSetup = vi.mocked(runSetup)
    mockRunSetup.mockResolvedValue({
      imapOk: true,
      smtpOk: true,
      folders: ['INBOX', 'Sent'],
      recommendations: [],
    })

    await expect(runAgent('setup')).resolves.toBeUndefined()
  })

  it('setup goal exits 2 when imap fails', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const mockRunSetup = vi.mocked(runSetup)
    mockRunSetup.mockResolvedValue({
      imapOk: false,
      smtpOk: true,
      folders: [],
      recommendations: ['Install Bridge'],
    })

    try {
      await runAgent('setup')
    } catch {
      // ignored — exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
  })
})

describe('executor pass-audit goal', () => {
  const OENV = { ...process.env }

  beforeAll(() => {
    // Set mail config but DON'T set PROTON_PASS_ENABLED
    process.env.PROTON_BRIDGE_USER = 'test@example.com'
    process.env.PROTON_BRIDGE_PASS = 'secret'
    process.env.PROTON_MAIL_FROM = 'test@example.com'
    delete process.env.PROTON_PASS_ENABLED
  })

  afterAll(() => {
    Object.assign(process.env, OENV)
    for (const k of Object.keys(OENV)) {
      if (!(k in OENV)) delete process.env[k]
    }
  })

  it('pass-audit goal exits 2 when pass not enabled', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    try {
      await runAgent('pass-audit')
    } catch {
      // ignored — exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
  })
})
