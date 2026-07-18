/**
 * Tests para src/ecosystem/binaries.ts (50.64% → objetivo 100%).
 *
 * Módulo sin I/O — datos puros y funciones puras.
 * Mock: ninguno (solo TypeScript).
 */
import { describe, it, expect } from 'vitest'
import type { Product } from '../../src/ecosystem/binaries.js'
import {
  REGISTRY,
  getBinaryInfo,
  installationGuide,
} from '../../src/ecosystem/binaries.js'

describe('REGISTRY', () => {
  it('tiene 4 productos', () => {
    expect(REGISTRY).toHaveLength(4)
  })

  it('cada entry tiene los campos requeridos', () => {
    for (const entry of REGISTRY) {
      expect(entry.name).toBeTruthy()
      expect(entry.product).toBeTruthy()
      expect(entry.defaultBin).toBeTruthy()
      expect(entry.installUrl).toBeTruthy()
      expect(Array.isArray(entry.versionCmd)).toBe(true)
    }
  })

  it('bridge tiene envVar y envPrefix', () => {
    const bridge = REGISTRY.find((r) => r.product === 'bridge')
    expect(bridge?.envVar).toBe('PROTON_BRIDGE_USER')
    expect(bridge?.envPrefix).toBe('PROTON_BRIDGE')
  })

  it('drive tiene healthCmd', () => {
    const drive = REGISTRY.find((r) => r.product === 'drive')
    expect(drive?.healthCmd).toEqual(['auth', 'status'])
  })

  it('gpg no tiene envVar, healthCmd ni envPrefix', () => {
    const gpg = REGISTRY.find((r) => r.product === 'gpg')
    expect(gpg?.envVar).toBeUndefined()
    expect(gpg?.healthCmd).toBeUndefined()
    expect(gpg?.envPrefix).toBeUndefined()
  })
})

describe('getBinaryInfo', () => {
  it('devuelve BinaryInfo para producto conocido (bridge)', () => {
    const info = getBinaryInfo('bridge')
    expect(info).toBeDefined()
    expect(info!.product).toBe('bridge')
    expect(info!.defaultBin).toBe('protonmail-bridge-core')
  })

  it('devuelve BinaryInfo para pass', () => {
    const info = getBinaryInfo('pass')
    expect(info).toBeDefined()
    expect(info!.product).toBe('pass')
  })

  it('devuelve BinaryInfo para drive', () => {
    const info = getBinaryInfo('drive')
    expect(info).toBeDefined()
    expect(info!.product).toBe('drive')
  })

  it('devuelve BinaryInfo para gpg', () => {
    const info = getBinaryInfo('gpg')
    expect(info).toBeDefined()
    expect(info!.product).toBe('gpg')
  })

  it('devuelve undefined para producto desconocido', () => {
    const info = getBinaryInfo('unknown' as Product)
    expect(info).toBeUndefined()
  })
})

describe('installationGuide', () => {
  it('bridge devuelve 4 pasos incluyendo .deb y pacman', () => {
    const guide = installationGuide('bridge')
    expect(guide.product).toBe('bridge')
    expect(guide.steps.length).toBeGreaterThanOrEqual(4)
    expect(guide.steps.some((s) => s.includes('.deb'))).toBe(true)
    expect(guide.steps.some((s) => s.includes('pacman'))).toBe(true)
  })

  it('pass devuelve pasos para arch, debian, macos', () => {
    const guide = installationGuide('pass')
    expect(guide.product).toBe('pass')
    expect(guide.steps.some((s) => s.includes('pacman -S pass'))).toBe(true)
    expect(guide.steps.some((s) => s.includes('apt install pass'))).toBe(true)
    expect(guide.steps.some((s) => s.includes('brew install pass'))).toBe(true)
  })

  it('drive devuelve 2 pasos', () => {
    const guide = installationGuide('drive')
    expect(guide.product).toBe('drive')
    expect(guide.steps).toHaveLength(2)
    expect(guide.steps[0]).toContain('Descarga el binario oficial')
  })

  it('gpg (fallback) devuelve un paso', () => {
    const guide = installationGuide('gpg')
    expect(guide.product).toBe('gpg')
    expect(guide.steps).toHaveLength(1)
    expect(guide.steps[0]).toContain('Instala GnuPG')
  })
})
