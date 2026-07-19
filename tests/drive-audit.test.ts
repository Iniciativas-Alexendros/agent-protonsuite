import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
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

  it('should scan inventory', () => {
    const inv = auditor.scanInventory(TMP)
    expect(inv.totalFiles).toBe(6)
    expect(inv.totalBytes).toBeGreaterThan(0)
    expect(inv.byExt['.md']).toBe(1)
    expect(inv.byExt['.doc']).toBe(1)
    expect(inv.byExt['.txt']).toBe(3)
    expect(inv.byExt['.jpg']).toBe(1)
  })

  it('should detect duplicates by content', () => {
    const dups = auditor.findDuplicates(TMP)
    expect(dups.length).toBeGreaterThanOrEqual(1)
    const dup = dups.find(
      (d) => d.hash === auditor.hashFile(resolve(TMP, 'duplicate.txt')),
    )
    expect(dup).toBeDefined()
    expect(dup!.files.length).toBe(2)
  })

  it('should report obsolete formats', () => {
    const fmt = auditor.formatReport(TMP)
    expect(fmt.obsoleteFiles.length).toBe(1)
    expect(fmt.obsoleteFiles[0].name).toBe('report.doc')
    expect(fmt.obsoleteExtensions).toEqual(['.doc', '.ppt', '.xls', '.bmp'])
  })

  it('should build organize plan', () => {
    const plan = auditor.buildOrganizePlan(TMP)
    expect(plan.suggestions.length).toBeGreaterThanOrEqual(1)
  })

  it('skips entries when statSync fails in scanInventory (broken symlink)', () => {
    try {
      symlinkSync('/nonexistent', resolve(TMP, 'broken.lnk'))
    } catch { /* platform may not support symlinks, skip test */
      return
    }
    const inv = auditor.scanInventory(TMP)
    // broken symlink is skipped, still counts normal files
    expect(inv.totalFiles).toBe(6)
  })

  it('skips entries when statSync fails in findDuplicates (broken symlink)', () => {
    try {
      symlinkSync('/nonexistent', resolve(TMP, 'broken2.lnk'))
    } catch { /* platform may not support symlinks, skip test */
      return
    }
    const dups = auditor.findDuplicates(TMP)
    expect(Array.isArray(dups)).toBe(true)
  })
})
