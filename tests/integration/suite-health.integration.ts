import { describe, expect } from 'vitest'
import { checkAllBinaries } from '../../src/ecosystem/discovery.js'
import { integrationTest } from './helpers'

describe('Suite — health', () => {
  integrationTest(
    'checkAllBinaries returns results for all products',
    () => {
      const results = checkAllBinaries()
      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) {
        expect(r).toHaveProperty('name')
        expect(r).toHaveProperty('product')
        expect(r).toHaveProperty('installed')
        expect(r).toHaveProperty('inPath')
      }
    },
  )
})
