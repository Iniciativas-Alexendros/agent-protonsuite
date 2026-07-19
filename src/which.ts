import { execFileSync } from 'node:child_process'
import { accessSync } from 'node:fs'

export function whichSync(name: string): string {
  const pathDirs = (process.env['PATH'] ?? '').split(':')
  for (const dir of pathDirs) {
    const candidate = `${dir}/${name}`
    try {
      accessSync(candidate)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error(`${name} not found in PATH`)
}

export function detectPlatform(): string | undefined {
  if (process.platform === 'darwin') return 'macos'
  if (process.platform !== 'linux') return undefined
  try {
    accessSync('/etc/arch-release')
    return 'arch'
  } catch {
    try {
      accessSync('/etc/debian_version')
      return 'debian'
    } catch {
      return undefined
    }
  }
}

export function detectDebianCodename(): string | undefined {
  try {
    const out = execFileSync('lsb_release', ['-cs'], {
      encoding: 'utf-8',
      timeout: 3000,
    })
    return out.trim()
  } catch {
    try {
      const content = execFileSync(
        'sh',
        ['-c', 'grep VERSION_CODENAME /etc/os-release | cut -d= -f2'],
        {
          encoding: 'utf-8',
          timeout: 3000,
        },
      )
      return content.trim()
    } catch {
      return undefined
    }
  }
}

export const Platform = detectPlatform()
export const Codename = detectDebianCodename()
