import { execFileSync } from 'node:child_process'
import { describe, expect } from 'vitest'
import { integrationTest } from './helpers'

describe('Pass — smoke', () => {
  integrationTest('pass --version succeeds',    () => {
    const output = execFileSync('pass', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    })
    expect(output.trim()).toBeTruthy()
  })

  integrationTest('pass ls runs without error',    () => {
    const output = execFileSync('pass', ['ls'], {
      encoding: 'utf-8',
      timeout: 5_000,
    })
    expect(output).toBeDefined()
  })
})
