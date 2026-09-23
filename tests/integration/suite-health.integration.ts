import { describe, expect, it } from 'vitest'
import { checkAllBinaries } from '../../src/ecosystem/discovery.js'

describe('Suite — health', () => {
  it('checkAllBinaries returns results for all products', () => {
    const results = checkAllBinaries()
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r).toHaveProperty('name')
      expect(r).toHaveProperty('product')
      expect(r).toHaveProperty('installed')
      expect(r).toHaveProperty('inPath')
    }
  })
})
