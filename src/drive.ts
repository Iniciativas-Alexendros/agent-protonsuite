/**
 * Proton Drive client base — wraps rclone.
 *
 * Las operaciones de Drive se delegan a rclone (remote configurado por el
 * usuario), que es quien habla con la API de Proton Drive. Esta clase base
 * resuelve rutas, expone el binario y valida dependencias. Las tools MCP y
 * los agent goals (Tasks 2-5) construyen encima de ella.
 */
import { execSync, execFile } from 'node:child_process'
import { resolve } from 'node:path'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  parentId?: string
  path: string
}

export interface DriveConfig {
  rcloneRemote?: string
  stagingDir: string
  syncMode: 'pull' | 'watch'
  rcloneBin: string
  obsoleteExtensions: string[]
}

export class DriveClient {
  constructor(
    public opts: DriveConfig,
    private log: {
      debug: (m: string, d?: unknown) => void
      info: (m: string, d?: unknown) => void
      error: (m: string, d?: unknown) => void
    },
  ) {}

  get stagingDir(): string {
    return resolve(this.opts.stagingDir.replace(/^~/, process.env.HOME ?? ''))
  }

  get rcloneBin(): string {
    return this.opts.rcloneBin
  }

  get remotePrefix(): string {
    return this.opts.rcloneRemote ?? ''
  }

  async execRclone(
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolvePromise, reject) => {
      execFile(
        this.rcloneBin,
        args,
        { maxBuffer: 50 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`rclone error: ${err.message}\nstderr: ${stderr}`))
            return
          }
          resolvePromise({ stdout, stderr })
        },
      )
    })
  }

  checkDeps(): { ok: boolean; error?: string } {
    try {
      execSync(`${this.rcloneBin} --version`, {
        encoding: 'utf-8',
        timeout: 5000,
      })
      if (!this.opts.rcloneRemote)
        return { ok: false, error: 'DRIVE_RCLONE_REMOTE not set' }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `rclone not found: ${(err as Error).message}` }
    }
  }
}
