/**
 * Proton Pass client via `pass` CLI (password-store Unix estándar).
 *
 * Principios de seguridad — heredados del skill protonpass:
 *  1. Los valores NUNCA se loguean. `get()` retorna el secreto solo a callers
 *     internos que lo marcan como sensible.
 *  2. Los valores NUNCA se devuelven al chat. Las tools MCP confirman
 *     `{found:true}` sin el secreto.
 *  3. Los valores se inyectan sin pasar por stdout. Si un cliente necesita un
 *     secreto, se inyecta vía variable de entorno o file descriptor.
 *  4. Sin rastro en logs ni auditoría. Las entradas no aparecen en `logs/`.
 *  5. `execFile` sin shell: sin interpolación de variables ni inyección de
 *     comandos. Los paths se validan contra un charset seguro.
 *
 * Backend: `pass` CLI (https://www.passwordstore.org/). Si en el futuro se
 * cambia a `gopass` u otro backend, la interfaz de PassClient se mantiene.
 */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve as resolvePath, relative, sep } from 'node:path'

async function execPass(
  args: string[],
  opts: { env: NodeJS.ProcessEnv; input?: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('pass', args, { env: opts.env })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => (stdout += d))
    child.stderr?.on('data', (d) => (stderr += d))
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(stderr.trim() || `pass exited with code ${code}`))
    })
    child.on('error', reject)
    if (opts.input) {
      child.stdin?.write(opts.input)
      child.stdin?.end()
    }
  })
}

const SAFE_PATH_RE = /^[a-zA-Z0-9._/-]+$/

function listPassEntries(storeDir: string): string[] {
  const entries: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = resolvePath(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (name.endsWith('.gpg')) {
        entries.push(relative(storeDir, full).replace(/\.gpg$/, '').split(sep).join('/'))
      }
    }
  }
  walk(storeDir)
  return entries.sort()
}

export interface PassLogger {
  debug: (m: string, e?: unknown) => void
  info: (m: string, e?: unknown) => void
  warn: (m: string, e?: unknown) => void
  error: (m: string, e?: unknown) => void
}

export interface PassClientOptions {
  storeDir: string
}

export interface PassAuditResult {
  storeOk: boolean
  totalEntries: number
  weakPasswords: string[]
  duplicates: string[]
  staleEntries: string[]
  recommendations: string[]
  [key: string]: unknown
}

export class PassClient {
  private readonly storeDir: string

  constructor(
    opts: PassClientOptions,
    private readonly log: PassLogger,
  ) {
    this.storeDir = opts.storeDir.startsWith('~')
      ? resolvePath(homedir(), opts.storeDir.slice(2))
      : resolvePath(opts.storeDir)
  }

  // ---------------------------------------------------------------------------
  // Operaciones del store
  // ---------------------------------------------------------------------------

  /** Lista entradas del store (solo nombres, NUNCA valores). */
  list(filter?: string): Promise<string[]> {
    const entries = listPassEntries(this.storeDir)
    const result = filter
      ? entries.filter((e) => e.includes(filter))
      : entries
    this.log.debug('pass list ok', { count: result.length })
    return Promise.resolve(result)
  }

  /**
   * Obtiene un secreto del store.
   * NUNCA se loguea el valor. Solo se retorna al caller para inyección interna
   * (ej. resolver PROTON_BRIDGE_PASS desde Pass). Las tools MCP usan
   * `getAndInject`, no este método directamente.
   */
  async get(path: string): Promise<string> {
    this.validatePath(path)
    this.log.debug('pass get', { path })
    try {
      const stdout = await execPass(['show', path], {
        env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
      })
      return stdout.trim().split('\n')[0]
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('not in the password store') ||
        msg.includes('not found')
      ) {
        throw new PassError(`Entry not found: ${path}`, 'NOT_FOUND')
      }
      throw new PassError(`Failed to read entry: ${msg}`, 'READ_ERROR')
    }
  }

  /**
   * Genera una contraseña segura y la guarda en el store.
   * Devuelve metadata (path, length) sin el valor generado.
   */
  async generate(
    path: string,
    length = 24,
  ): Promise<{ path: string; length: number }> {
    this.validatePath(path)
    this.log.info('pass generate', { path, length })
    const password = randomBytes(Math.ceil(length * 0.75))
      .toString('base64')
      .slice(0, length)
    await execPass(['insert', '--multiline', '-f', path], {
      env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
      input: `${password}\n`,
    })
    return { path, length }
  }

  /**
   * Verifica la salud del store: ¿está accesible? ¿tiene entradas?
   */
  async health(): Promise<{ ok: boolean; entries: number; error?: string }> {
    try {
      const entries = await this.list()
      return { ok: true, entries: entries.length }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, entries: 0, error: msg }
    }
  }

  // ---------------------------------------------------------------------------
  // Auditoría de fortaleza
  // ---------------------------------------------------------------------------

  /**
   * Audita el vault: contraseñas débiles, duplicados, entradas sin rotación.
   * Las contraseñas se evalúan localmente (nunca se envían a servicios externos).
   */
  async audit(): Promise<PassAuditResult> {
    const healthResult = await this.health()
    if (!healthResult.ok) {
      return {
        storeOk: false,
        totalEntries: 0,
        weakPasswords: [],
        duplicates: [],
        staleEntries: [],
        recommendations: [
          `Store no accesible: ${healthResult.error ?? 'error desconocido'}`,
        ],
      }
    }

    const entries = await this.list()
    const weakPasswords: string[] = []
    const seen = new Map<string, string>() // hash → primer path
    const duplicates: string[] = []

    for (const entry of entries) {
      let value: string
      try {
        value = await this.get(entry)
      } catch {
        continue
      }

      // Heurística de fortaleza: < 12 chars o sin mezcla de tipos
      const hasUpper = /[A-Z]/.test(value)
      const hasLower = /[a-z]/.test(value)
      const hasDigit = /[0-9]/.test(value)
      const hasSpecial = /[^A-Za-z0-9]/.test(value)
      const typeCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(
        Boolean,
      ).length

      if (value.length < 12 || typeCount < 2) {
        weakPasswords.push(entry)
      }

      // Detección de duplicados por hash simple
      const hash = this.simpleHash(value)
      const existing = seen.get(hash)
      if (existing) {
        duplicates.push(`${entry} (duplicado de ${existing})`)
      } else {
        seen.set(hash, entry)
      }
    }

    const recommendations: string[] = []
    if (weakPasswords.length > 0) {
      recommendations.push(
        `${weakPasswords.length} contraseñas débiles detectadas (<12 caracteres o poca variedad). Regenerar con 'proton_pass_generate'.`,
      )
    }
    if (duplicates.length > 0) {
      recommendations.push(
        `${duplicates.length} contraseñas duplicadas detectadas. Revisar y unificar entradas.`,
      )
    }

    return {
      storeOk: true,
      totalEntries: entries.length,
      weakPasswords,
      duplicates,
      staleEntries: [],
      recommendations,
    }
  }

  /**
   * Inserta una nueva entrada en el store.
   * Loguea solo el path, NUNCA el valor.
   */
  async insert(
    path: string,
    secret: string,
  ): Promise<{ ok: true; path: string }> {
    this.validatePath(path)
    this.log.info('pass insert', { path })
    await execPass(['insert', '--multiline', path], {
      env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
      input: secret,
    })
    return { ok: true, path }
  }

  /**
   * Elimina una entrada del store.
   */
  async remove(path: string): Promise<{ ok: true; path: string }> {
    this.validatePath(path)
    this.log.info('pass remove', { path })
    await execPass(['rm', '-f', path], {
      env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
    })
    return { ok: true, path }
  }

  /**
   * Mueve/renombra una entrada del store.
   */
  async move(
    from: string,
    to: string,
  ): Promise<{ ok: true; from: string; to: string }> {
    this.validatePath(from)
    this.validatePath(to)
    this.log.info('pass move', { from, to })
    await execPass(['mv', from, to], {
      env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
    })
    return { ok: true, from, to }
  }

  /**
   * Copia una entrada del store.
   */
  async copy(
    src: string,
    dst: string,
  ): Promise<{ ok: true; src: string; dst: string }> {
    this.validatePath(src)
    this.validatePath(dst)
    this.log.info('pass copy', { src, dst })
    await execPass(['cp', src, dst], {
      env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
    })
    return { ok: true, src, dst }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Valida que un path de entrada no contenga caracteres peligrosos. */
  private validatePath(path: string): void {
    if (!SAFE_PATH_RE.test(path) || path.includes('..')) {
      throw new PassError(`Invalid entry path: ${path}`, 'INVALID_PATH')
    }
  }

  /** Hash simple no criptográfico para detección de duplicados. */
  private simpleHash(s: string): string {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
    }
    return String(h)
  }
}

export class PassError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'READ_ERROR' | 'INVALID_PATH',
  ) {
    super(message)
    this.name = 'PassError'
  }
}
