import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DriveAuditor } from '../src/drive-audit.js'

const TMP = '/tmp/test-drive-audit'

describe('DriveAuditor', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
    mkdirSync(resolve(TMP, 'docs'), { recursive: true })
    mkdirSync(resolve(TMP, 'images'), { recursive: true })
    writeFileSync(resolve(TMP, 'readme.md'), '# Hello')
    writeFileSync(resolve(TMP, 'docs', 'report.doc'), 'old format')
    writeFileSync(resolve(TMP, 'docs', 'notes.txt'), 'some notes')
    writeFileSync(resolve(TMP, 'images', 'photo.jpg'), Buffer.alloc(1024))
    writeFileSync(resolve(TMP, 'duplicate.txt'), 'same content')
    writeFileSync(resolve(TMP, 'docs', 'duplicate.txt'), 'same content')
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  const auditor = new DriveAuditor(['.doc', '.ppt', '.xls', '.bmp'], {
    debug: () => {},
    info: () => {},
    error: () => {},
  })

  it('should scan inventory', async () => {
    const inv = auditor.scanInventory(TMP)
    expect(inv.totalFiles).toBe(6)
    expect(inv.totalBytes).toBeGreaterThan(0)
    expect(inv.byExt['.md']).toBe(1)
    expect(inv.byExt['.doc']).toBe(1)
    expect(inv.byExt['.txt']).toBe(3)
    expect(inv.byExt['.jpg']).toBe(1)
  })

  it('should detect duplicates by content', async () => {
    const dups = auditor.findDuplicates(TMP)
    expect(dups.length).toBeGreaterThanOrEqual(1)
    const dup = dups.find(
      (d) => d.hash === auditor.hashFile(resolve(TMP, 'duplicate.txt')),
    )
    expect(dup).toBeDefined()
    expect(dup!.files.length).toBe(2)
  })

  it('should report obsolete formats', async () => {
    const fmt = auditor.formatReport(TMP)
    expect(fmt.obsoleteFiles.length).toBe(1)
    expect(fmt.obsoleteFiles[0].name).toBe('report.doc')
    expect(fmt.obsoleteExtensions).toEqual(['.doc', '.ppt', '.xls', '.bmp'])
  })

  it('should build organize plan', async () => {
    const plan = auditor.buildOrganizePlan(TMP)
    expect(plan.suggestions.length).toBeGreaterThanOrEqual(1)
  })
})
