import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { binarySmokeTest, hasBinary, hasPassStore } from './helpers'

describe('Pass — smoke', () => {
  binarySmokeTest('pass --version succeeds', 'pass', () => {
    const output = execFileSync('pass', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    })
    expect(output.trim()).toBeTruthy()
  })

  const listName = 'pass ls runs without error'
  if (hasBinary('pass') && hasPassStore()) {
    it(listName, () => {
      const output = execFileSync('pass', ['ls'], {
        encoding: 'utf-8',
        timeout: 5_000,
      })
      expect(output).toBeDefined()
    })
  } else {
    it.skip(listName)
  }
})
