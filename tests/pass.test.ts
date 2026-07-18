/**
 * Tests para src/pass.ts (60.71% → objetivo ~95%).
 *
 * PassClient opera sobre pass-cli via execFile (ChildProcess event API).
 * Mock: execFile devuelve un objeto ChildProcess-like que captura handlers.
 * Los tests disparan eventos con emitData / emitClose tras la llamada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PassClient, PassError } from '../src/pass.js'

const hoisted = vi.hoisted(() => {
  const captured: Array<{
    emitData: (d: string) => void
    emitStderr: (d: string) => void
    emitClose: (code: number) => void
    emitError: (err: Error) => void
    stdinWrite: ReturnType<typeof vi.fn>
    stdinEnd: ReturnType<typeof vi.fn>
  }> = []

  const mockExecFile = vi.fn((_bin: string, _args: string[], _opts: { input?: string }) => {
    let dataHandler: ((d: string) => void) | null = null
    let stderrHandler: ((d: string) => void) | null = null
    let closeHandler: ((code: number) => void) | null = null
    let errorHandler: ((err: Error) => void) | null = null
    const stdinWrite = vi.fn()
    const stdinEnd = vi.fn()

    const entry = {
      emitData: (d: string) => dataHandler?.(d),
      emitStderr: (d: string) => stderrHandler?.(d),
      emitClose: (code: number) => closeHandler?.(code),
      emitError: (err: Error) => errorHandler?.(err),
      stdinWrite,
      stdinEnd,
    }
    captured.push(entry)

    return {
      stdout: { on: (_e: string, h: (d: string) => void) => { dataHandler = h } },
      stderr: { on: (_e: string, h: (d: string) => void) => { stderrHandler = h } },
      stdin: { write: stdinWrite, end: stdinEnd },
      on: (_e: string, h: ((code: number) => void) | ((err: Error) => void)) => {
        if (_e === 'close') closeHandler = h as (code: number) => void
        if (_e === 'error') errorHandler = h as (err: Error) => void
      },
    }
  })

  const mockReaddir = vi.fn()
  const silentLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  return { mockExecFile, mockReaddir, silentLog, captured }
})

vi.mock('node:child_process', () => ({
  execFile: hoisted.mockExecFile,
}))

vi.mock('node:fs/promises', () => ({
  readdir: hoisted.mockReaddir,
}))

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.captured.length = 0
})

function makeClient(storeDir = '/tmp/password-store') {
  return new PassClient({ storeDir }, hoisted.silentLog)
}

describe('PassClient', () => {
  describe('constructor', () => {
    it('resuelve storeDir con ~', () => {
      const c = new PassClient({ storeDir: '~/pass-store' }, hoisted.silentLog)
      expect(c).toBeDefined()
    })
  })

  describe('list', () => {
    it('lista entradas .gpg del store', async () => {
      hoisted.mockReaddir.mockResolvedValue(['entry1.gpg', 'entry2.gpg', 'note.txt'])
      const result = await makeClient().list()
      expect(result).toEqual(['entry1', 'entry2'])
    })

    it('filtra por string cuando se pasa filter', async () => {
      hoisted.mockReaddir.mockResolvedValue(['proton/bridge.gpg', 'proton/mail.gpg', 'personal/gmail.gpg'])
      const result = await makeClient().list('proton')
      expect(result).toEqual(['proton/bridge', 'proton/mail'])
    })

    it('devuelve array vacío si filter no coincide', async () => {
      hoisted.mockReaddir.mockResolvedValue(['entry.gpg'])
      const result = await makeClient().list('nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('get', () => {
    it('devuelve primera línea del secreto', async () => {
      const c = makeClient()
      const promise = c.get('proton/bridge')
      const entry = hoisted.captured[0]
      entry.emitData('my-secret-password\nline2\n')
      entry.emitClose(0)
      const result = await promise
      expect(result).toBe('my-secret-password')
    })

    it('lanza PassError NOT_FOUND cuando stderr contiene "not in the password store"', async () => {
      const c = makeClient()
      const promise = c.get('missing/entry')
      const entry = hoisted.captured[0]
      entry.emitStderr('pass: entry not in the password store')
      entry.emitClose(1)
      await expect(promise).rejects.toThrow(PassError)
      await expect(promise).rejects.toThrow('Entry not found')
    })

    it('lanza PassError READ_ERROR cuando stderr contiene otros errores', async () => {
      const c = makeClient()
      const promise = c.get('weird/entry')
      const entry = hoisted.captured[0]
      entry.emitStderr('gpg: decryption failed')
      entry.emitClose(1)
      await expect(promise).rejects.toThrow('Failed to read')
    })

    it('lanza PassError INVALID_PATH para path con ..', async () => {
      await expect(makeClient().get('../etc/passwd')).rejects.toThrow('Invalid entry path')
      expect(hoisted.mockExecFile).not.toHaveBeenCalled()
    })

    it('lanza PassError INVALID_PATH para path con caracteres peligrosos', async () => {
      await expect(makeClient().get('entry; rm -rf /')).rejects.toThrow('Invalid entry path')
    })
  })

  describe('generate', () => {
    it('genera contraseña y la inserta via execFile', async () => {
      const c = makeClient()
      const promise = c.generate('new/entry', 30)
      const entry = hoisted.captured[0]
      expect(entry.stdinWrite).toHaveBeenCalled()
      entry.emitClose(0)
      const result = await promise
      expect(result.path).toBe('new/entry')
      expect(result.length).toBe(30)
    })

    it('lanza error cuando execFile falla', async () => {
      const c = makeClient()
      const promise = c.generate('new/entry', 12)
      const entry = hoisted.captured[0]
      entry.emitError(new Error('EPERM'))
      await expect(promise).rejects.toThrow()
    })
  })

  describe('health', () => {
    it('ok=true con entries count', async () => {
      hoisted.mockReaddir.mockResolvedValue(['a.gpg', 'b.gpg'])
      const result = await makeClient().health()
      expect(result.ok).toBe(true)
      expect(result.entries).toBe(2)
    })

    it('ok=false cuando list lanza', async () => {
      hoisted.mockReaddir.mockRejectedValue(new Error('ENOENT'))
      const result = await makeClient().health()
      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('insert', () => {
    it('inserta secreto y devuelve path', async () => {
      const c = makeClient()
      const promise = c.insert('new/entry', 'super-secret')
      const entry = hoisted.captured[0]
      expect(entry.stdinWrite).toHaveBeenCalledWith('super-secret')
      entry.emitClose(0)
      const result = await promise
      expect(result.path).toBe('new/entry')
    })
  })

  describe('remove', () => {
    it('elimina entrada y devuelve path', async () => {
      const c = makeClient()
      const promise = c.remove('old/entry')
      const entry = hoisted.captured[0]
      entry.emitClose(0)
      const result = await promise
      expect(result.path).toBe('old/entry')
    })

    it('llama execFile con rm -f', async () => {
      makeClient().remove('old/entry').catch(() => {})
      expect(hoisted.mockExecFile).toHaveBeenCalledWith('pass', ['rm', '-f', 'old/entry'], expect.any(Object))
    })
  })

  describe('move', () => {
    it('mueve entrada y devuelve from/to', async () => {
      const c = makeClient()
      const promise = c.move('old/path', 'new/path')
      const entry = hoisted.captured[0]
      entry.emitClose(0)
      const result = await promise
      expect(result.from).toBe('old/path')
      expect(result.to).toBe('new/path')
    })

    it('llama execFile con mv', async () => {
      makeClient().move('a', 'b').catch(() => {})
      expect(hoisted.mockExecFile).toHaveBeenCalledWith('pass', ['mv', 'a', 'b'], expect.any(Object))
    })
  })

  describe('copy', () => {
    it('copia entrada y devuelve src/dst', async () => {
      const c = makeClient()
      const promise = c.copy('src/entry', 'dst/entry')
      const entry = hoisted.captured[0]
      entry.emitClose(0)
      const result = await promise
      expect(result.src).toBe('src/entry')
      expect(result.dst).toBe('dst/entry')
    })

    it('llama execFile con cp', async () => {
      makeClient().copy('s', 'd').catch(() => {})
      expect(hoisted.mockExecFile).toHaveBeenCalledWith('pass', ['cp', 's', 'd'], expect.any(Object))
    })
  })

  describe('audit', () => {
    it('storeOk=false cuando health falla', async () => {
      hoisted.mockReaddir.mockRejectedValue(new Error('ENOENT'))
      const result = await makeClient().audit()
      expect(result.storeOk).toBe(false)
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('detecta contraseñas débiles y duplicados', async () => {
      hoisted.mockReaddir.mockResolvedValue(['weak.gpg', 'strong.gpg', 'dup.gpg'])
      const c = makeClient()

      // audit() necesita que cada get() resuelva antes de pasar al siguiente entry
      // Por eso emitimos eventos incrementalmente: capturamos 1, resolvemos 1, etc.
      const promise = c.audit()

      // Esperar a que audit procese health + list y llame al primer get()
      for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0))
      expect(hoisted.captured.length).toBe(1)

      // Resolver entry 1: 'abc' → débil
      hoisted.captured[0].emitData('abc\n')
      hoisted.captured[0].emitClose(0)
      for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0))
      expect(hoisted.captured.length).toBe(2)

      // Resolver entry 2: 'StrongP@ss1' → fuerte
      hoisted.captured[1].emitData('StrongP@ss1\n')
      hoisted.captured[1].emitClose(0)
      for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0))
      expect(hoisted.captured.length).toBe(3)

      // Resolver entry 3: 'abc' → débil + duplicado
      hoisted.captured[2].emitData('abc\n')
      hoisted.captured[2].emitClose(0)

      const result = await promise
      expect(result.storeOk).toBe(true)
      expect(result.totalEntries).toBe(3)
      expect(result.weakPasswords).toContain('weak')
      expect(result.duplicates.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('validatePath', () => {
    it('lanza PassError para path con ..', async () => {
      await expect(makeClient().get('../evil')).rejects.toThrow('Invalid entry path')
    })

    it('lanza PassError para path con caracteres no seguros', async () => {
      await expect(makeClient().get('path;ls')).rejects.toThrow('Invalid entry path')
    })

    it('acepta paths seguros', async () => {
      const c = makeClient()
      const promise = c.get('proton/bridge/api-key')
      const entry = hoisted.captured[0]
      entry.emitData('secret\n')
      entry.emitClose(0)
      await expect(promise).resolves.toBe('secret')
    })
  })
})
