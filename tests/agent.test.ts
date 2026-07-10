import { describe, it, expect, vi } from 'vitest'
import {
  parseGoal,
  describeGoal,
  buildGoalContext,
  runAgent,
} from '../src/agent/index.js'
import type { GoalContext } from '../src/agent/index.js'

describe('agent goals', () => {
  it('parses known goals', () => {
    expect(parseGoal('discover')).toBe('discover')
    expect(parseGoal('setup')).toBe('setup')
    expect(parseGoal('organize')).toBe('organize')
    expect(parseGoal('monitor')).toBe('monitor')
    expect(parseGoal('alert')).toBe('alert')
  })

  it('defaults to setup', () => {
    expect(parseGoal(undefined)).toBe('setup')
  })

  it('parses drive goals', () => {
    expect(parseGoal('drive-audit')).toBe('drive-audit')
    expect(parseGoal('drive-organize')).toBe('drive-organize')
    expect(parseGoal('drive-sync')).toBe('drive-sync')
  })

  it('rejects unknown goals', () => {
    expect(() => parseGoal('delete')).toThrow(/Unknown agent goal/)
  })

  it('describes goals in Spanish', () => {
    expect(describeGoal('discover')).toContain('Descubre')
    expect(describeGoal('organize')).toContain('Analiza')
  })

  it('builds goal context from config', () => {
    const ctx = buildGoalContext('organize', {
      dryRun: true,
      maxInspectEmails: 42,
      minConfidence: 0.5,
    })
    const expected: GoalContext = {
      goal: 'organize',
      dryRun: true,
      maxInspectEmails: 42,
      minConfidence: 0.5,
    }
    expect(ctx).toEqual(expected)
  })

  it('drive-audit goal exits 2 when DRIVE_RCLONE_REMOTE is unset', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const prevRemote = process.env.DRIVE_RCLONE_REMOTE
    delete process.env.DRIVE_RCLONE_REMOTE
    // Provide minimal valid mail config so loadConfig() passes and the
    // drive gate (not config validation) is the path exercised.
    const validEmail = 'test' + '@' + 'example.com'
    const prevUser = process.env.PROTON_BRIDGE_USER
    const prevPass = process.env.PROTON_BRIDGE_PASS
    const prevFrom = process.env.PROTON_MAIL_FROM
    process.env.PROTON_BRIDGE_USER = validEmail
    process.env.PROTON_BRIDGE_PASS = 'secret'
    process.env.PROTON_MAIL_FROM = validEmail
    try {
      await runAgent('drive-audit')
    } catch {
      // runAgent may throw after exit is mocked; ignore
    }
    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
    if (prevRemote === undefined) delete process.env.DRIVE_RCLONE_REMOTE
    else process.env.DRIVE_RCLONE_REMOTE = prevRemote
    if (prevUser === undefined) delete process.env.PROTON_BRIDGE_USER
    else process.env.PROTON_BRIDGE_USER = prevUser
    if (prevPass === undefined) delete process.env.PROTON_BRIDGE_PASS
    else process.env.PROTON_BRIDGE_PASS = prevPass
    if (prevFrom === undefined) delete process.env.PROTON_MAIL_FROM
    else process.env.PROTON_MAIL_FROM = prevFrom
  })
})
