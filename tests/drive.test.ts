import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DriveClient } from '../src/drive.js'

// Mock del módulo `node:child_process` para sustituir execFile/execFileSync por
// stubs controlables que devuelven respuestas pre-armadas según subcomando.
vi.mock('node:child_process', () => ({
  execFile: (
    _cmd: unknown,
    args: unknown,
    _opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const argv = Array.isArray(args) ? (args as string[]) : []
    const dispatch = mockStore.dispatch.get(argv[0] ?? '')
    if (!dispatch) {
      cb(
        new Error(`unmocked proton-drive subcommand: ${argv.join(' ')}`),
        '',
        '',
      )
      return
    }
    dispatch(cb, argv)
  },
  execFileSync: (_cmd: unknown, args: unknown, _opts: unknown) => {
    if (Array.isArray(args) && args[0] === '--version') {
      return 'proton-drive 1.0.0 (mocked)'
    }
    throw new Error('unmocked execFileSync')
  },
}))

type Dispatch = (
  cb: (err: Error | null, stdout: string, stderr: string) => void,
  argv: string[],
) => void
const mockStore = {
  authResult: true as boolean,
  dispatch: new Map<string, Dispatch>(),
}

function mockAuthSucceeds() {
  mockStore.authResult = true
  mockStore.dispatch.set('auth', (_cb, _argv) => {
    _cb(null, 'authenticated', '')
  })
}
function mockAuthFails() {
  mockStore.authResult = false
  mockStore.dispatch.set('auth', (_cb, _argv) => {
    _cb(new Error('not authenticated'), '', 'no auth')
  })
}
function mockListSucceeds(json: unknown) {
  mockStore.dispatch.set('filesystem', (cb, argv) => {
    if (argv[1] === 'list') {
      cb(null, JSON.stringify(json), '')
      return
    }
    if (argv[1] === 'download' || argv[1] === 'upload') {
      cb(null, '', '')
      return
    }
    cb(new Error(`unexpected fs subcommand: ${argv.join(' ')}`), '', '')
  })
}
function mockSharingSucceeds() {
  mockStore.dispatch.set('sharing', (cb, _argv) => {
    cb(null, '', '')
  })
}
function mockAllFail(msg: string) {
  mockStore.dispatch.clear()
  const fail = (
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    cb(new Error(msg), '', msg)
  }
  mockStore.dispatch.set('auth', fail)
  mockStore.dispatch.set('filesystem', fail)
  mockStore.dispatch.set('sharing', fail)
}

beforeEach(() => {
  mockStore.dispatch = new Map<string, Dispatch>()
})
afterEach(() => {
  mockStore.dispatch.clear()
})

const silentLog = {
  debug: () => {},
  info: () => {},
  error: () => {},
}

describe('DriveClient — stagingDir', () => {
  it('resuelve stagingDir absoluto', () => {
    const dc = new DriveClient(
      {
        cliBin: 'proton-drive',
        stagingDir: '/tmp/test-drive',
        obsoleteExtensions: [],
      },
      silentLog,
    )
    expect(dc.stagingDir).toBe('/tmp/test-drive')
  })

  it('expande ~ en stagingDir', () => {
    const dc = new DriveClient(
      {
        cliBin: 'proton-drive',
        stagingDir: '~/test-drive',
        obsoleteExtensions: [],
      },
      silentLog,
    )
    expect(dc.stagingDir).toBe(`${process.env.HOME}/test-drive`)
  })
})

describe('DriveClient — checkDeps', () => {
  it('reporta OK cuando el binario responde a --version', () => {
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = dc.checkDeps()
    expect(r.ok).toBe(true)
    expect(r.version).toBe('proton-drive 1.0.0 (mocked)')
  })
})

describe('DriveClient — listFiles', () => {
  it('parsea JSON del CLI a DriveListEntry[]', async () => {
    mockAuthSucceeds()
    mockListSucceeds([
      { name: 'doc.md', path: '/my-files/doc.md', size: 1024, type: 'file' },
      { name: 'images', path: '/my-files/images', type: 'folder' },
    ])
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.listFiles('/my-files')
    expect(r.ok).toBe(true)
    expect(r.files).toHaveLength(2)
    expect(r.files[0]!.name).toBe('doc.md')
    expect(r.files[1]!.type).toBe('folder')
  })

  it('acepta payload envuelto en `files`', async () => {
    mockAuthSucceeds()
    mockListSucceeds({ files: [{ name: 'a.txt' }, { name: 'b.txt' }] })
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.listFiles('/my-files')
    expect(r.ok).toBe(true)
    expect(r.files).toHaveLength(2)
  })

  it('devuelve error si el CLI falla', async () => {
    mockAllFail('not authenticated')
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.listFiles('/my-files')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('not authenticated')
    expect(r.files).toEqual([])
  })
})

describe('DriveClient — download / upload / share', () => {
  it('download devuelve ok cuando el CLI aprueba', async () => {
    mockAuthSucceeds()
    mockListSucceeds([])
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.download('/my-files')
    expect(r.ok).toBe(true)
    expect(r.localPath).toBe('/tmp/d')
    expect(r.remotePath).toBe('/my-files')
  })

  it('upload devuelve ok cuando el CLI aprueba', async () => {
    mockAuthSucceeds()
    mockListSucceeds([])
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.upload()
    expect(r.ok).toBe(true)
    expect(r.localPath).toBe('/tmp/d')
    expect(r.remotePath).toBe('/my-files')
  })

  it('share devuelve ok cuando el CLI aprueba', async () => {
    mockAuthSucceeds()
    mockSharingSucceeds()
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.share('/my-files/Documents', 'friend@proton.me')
    expect(r.ok).toBe(true)
    expect(r.remotePath).toBe('/my-files/Documents')
    expect(r.userEmail).toBe('friend@proton.me')
  })

  it('propaga error de la CLI', async () => {
    mockAllFail('rate limited')
    const dc = new DriveClient(
      { cliBin: 'proton-drive', stagingDir: '/tmp/d', obsoleteExtensions: [] },
      silentLog,
    )
    const r = await dc.share('/my-files/x', 'a@b.com')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('rate limited')
  })
})

describe('DriveClient — status', () => {
  it('indica autenticado=false cuando auth falla', async () => {
    mockAuthFails()
    const dc = new DriveClient(
      {
        cliBin: 'proton-drive',
        stagingDir: '/tmp/none',
        obsoleteExtensions: [],
      },
      silentLog,
    )
    const st = await dc.status()
    expect(st.authenticated).toBe(false)
    expect(st.configured).toBe(true)
    expect(st.cliPath).toBe('proton-drive')
  })

  it('indica autenticado=true cuando auth responde', async () => {
    mockAuthSucceeds()
    const dc = new DriveClient(
      {
        cliBin: 'proton-drive',
        stagingDir: '/tmp/none',
        obsoleteExtensions: [],
      },
      silentLog,
    )
    const st = await dc.status()
    expect(st.authenticated).toBe(true)
    expect(st.stagingExists).toBe(false)
    expect(st.stagingFiles).toBeUndefined()
  })
})
