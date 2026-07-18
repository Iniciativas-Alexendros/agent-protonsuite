/**
 * Tests para src/which.ts (49.09% → objetivo ~95%).
 *
 * Mockea:
 *  - node:child_process → execFileSync
 *  - node:fs → accessSync
 *
 * Funciones: whichSync, detectPlatform, detectDebianCodename
 * Constantes de módulo: Platform, Codename (eval hooks)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  const mockAccessSync = vi.fn()
  const mockExecFileSync = vi.fn()
  return { mockAccessSync, mockExecFileSync }
})

vi.mock('node:child_process', () => ({
  execFileSync: hoisted.mockExecFileSync,
}))
vi.mock('node:fs', () => ({
  accessSync: hoisted.mockAccessSync,
}))

import { whichSync, detectPlatform, detectDebianCodename, Platform, Codename } from '../src/which.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('whichSync', () => {
  const origPath = process.env.PATH

  afterEach(() => {
    process.env.PATH = origPath
  })

  it('encuentra binario en PATH', () => {
    process.env.PATH = '/usr/bin:/usr/local/bin'
    hoisted.mockAccessSync.mockImplementation((path: string) => {
      if (path === '/usr/bin/gpg') return undefined
      throw new Error('ENOENT')
    })

    const result = whichSync('gpg')
    expect(result).toBe('/usr/bin/gpg')
  })

  it('lanza error cuando no encuentra el binario', () => {
    process.env.PATH = '/usr/bin'
    hoisted.mockAccessSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })

    expect(() => whichSync('missing-bin')).toThrow('missing-bin not found in PATH')
  })

  it('usa PATH vacío si no está definido (split da [""])', () => {
    delete process.env.PATH
    expect(() => whichSync('anything')).toThrow('anything not found in PATH')
    // PATH='' → split(':') → [''] → accessSync('') falla → lanza
    expect(hoisted.mockAccessSync).toHaveBeenCalledTimes(1)
    expect(hoisted.mockAccessSync).toHaveBeenCalledWith('/anything')
  })
})

describe('detectPlatform', () => {
  const origPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: origPlatform })
  })

  it('macos cuando process.platform === darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    expect(detectPlatform()).toBe('macos')
  })

  it('undefined cuando platform no es darwin ni linux', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(detectPlatform()).toBeUndefined()
  })

  it('arch cuando /etc/arch-release existe', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    hoisted.mockAccessSync.mockImplementation((p: string) => {
      if (p === '/etc/arch-release') return undefined
      throw new Error('ENOENT')
    })
    expect(detectPlatform()).toBe('arch')
    expect(hoisted.mockAccessSync).toHaveBeenCalledWith('/etc/arch-release')
  })

  it('debian cuando /etc/arch-release falla pero /etc/debian_version existe', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    hoisted.mockAccessSync
      .mockImplementationOnce(() => { throw new Error('ENOENT') })  // arch-release fail
      .mockImplementationOnce(() => undefined)                       // debian_version ok
    expect(detectPlatform()).toBe('debian')
    expect(hoisted.mockAccessSync).toHaveBeenCalledWith('/etc/debian_version')
  })

  it('undefined en linux cuando ningún archivo de release existe', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    hoisted.mockAccessSync.mockImplementation(() => { throw new Error('ENOENT') })
    expect(detectPlatform()).toBeUndefined()
    expect(hoisted.mockAccessSync).toHaveBeenCalledTimes(2)
  })
})

describe('detectDebianCodename', () => {
  it('devuelve output de lsb_release -cs cuando funciona', () => {
    hoisted.mockExecFileSync.mockReturnValue('noble\n')
    expect(detectDebianCodename()).toBe('noble')
    expect(hoisted.mockExecFileSync).toHaveBeenCalledWith(
      'lsb_release', ['-cs'], expect.any(Object),
    )
  })

  it('fallback a grep VERSION_CODENAME cuando lsb_release falla', () => {
    hoisted.mockExecFileSync
      .mockImplementationOnce(() => { throw new Error('not found') }) // lsb_release fail
      .mockReturnValueOnce('jammy\n')                                 // sh fallback ok
    expect(detectDebianCodename()).toBe('jammy')
  })

  it('undefined cuando ambos fallan', () => {
    hoisted.mockExecFileSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectDebianCodename()).toBeUndefined()
    expect(hoisted.mockExecFileSync).toHaveBeenCalledTimes(2)
  })
})

describe('Platform y Codename (constantes de módulo)', () => {
  it('Platform se evalúa en linux como arch (accessSync no lanza por defecto)', () => {
    // mockAccessSync devuelve undefined (no lanza), así que detectPlatform
    // pasa accessSync('/etc/arch-release') y devuelve 'arch'
    expect(Platform).toBe('arch')
  })

  it('Codename es undefined (execFileSync devuelve undefined → .trim() lanza)', () => {
    // mockExecFileSync devuelve undefined, undefined.trim() lanza TypeError
    // catch → fallback sh → mismo resultado → undefined
    expect(Codename).toBeUndefined()
  })
})
