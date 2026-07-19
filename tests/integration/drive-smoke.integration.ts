import { execFileSync } from 'node:child_process'
import { describe, expect } from 'vitest'
import { integrationTest } from './helpers'

describe('Drive — smoke', () => {
  integrationTest('proton-drive --version succeeds',    () => {
    const output = execFileSync('proton-drive', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    })
    expect(output.trim()).toBeTruthy()
  })

  integrationTest('proton-drive auth status runs',    () => {
    const output = execFileSync('proton-drive', ['auth', 'status'], {
      encoding: 'utf-8',
      timeout: 15_000,
    })
    expect(output).toBeDefined()
  })
})
