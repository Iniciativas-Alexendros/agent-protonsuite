import { execFileSync } from 'node:child_process'
import { describe, expect } from 'vitest'
import { binarySmokeTest } from './helpers'

describe('Drive — smoke', () => {
  binarySmokeTest('proton-drive --version succeeds', 'proton-drive', () => {
    const output = execFileSync('proton-drive', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    })
    expect(output.trim()).toBeTruthy()
  })

  binarySmokeTest('proton-drive auth status runs', 'proton-drive', () => {
    const output = execFileSync('proton-drive', ['auth', 'status'], {
      encoding: 'utf-8',
      timeout: 15_000,
    })
    expect(output).toBeDefined()
  })
})
