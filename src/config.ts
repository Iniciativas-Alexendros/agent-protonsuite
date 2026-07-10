/**
 * Configuración y logger — Proton Suite Agent.
 *
 * Filosofía:
 *  - Validación única al arranque con Zod. Si falta algo, el proceso muere
 *    con un error descriptible en vez de explotar en runtime a mitad de una
 *    request.
 *  - Logger que escribe SIEMPRE a stderr. En modo stdio el stdout está
 *    reservado al JSON-RPC de MCP; contaminarlo con texto de log rompería el
 *    protocolo en silencio.
 *  - Niveles estándar (error/warn/info/debug) sin dependencia de librerías
 *    pesadas como pino/winston. Si en el futuro queremos structured logs,
 *    `createLogger` se sustituye sin tocar el resto del código.
 *  - Schema multi-producto: cada producto (mail, pass, calendar, drive) tiene
 *    su bloque de configuración con `enabled` como gate. Los productos no
 *    configurados no se inicializan y sus tools no se registran.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Drive schema — rclone backend, configurable por env vars.
// ---------------------------------------------------------------------------
export const DriveConfigSchema = z.object({
  enabled: z.boolean().default(false),
  rcloneRemote: z.string().optional(),
  stagingDir: z.string().default('~/.protonmail/drive/'),
  syncMode: z.enum(['pull', 'watch']).default('pull'),
  rcloneBin: z.string().default('rclone'),
  obsoleteExtensions: z
    .array(z.string())
    .default(['.doc', '.ppt', '.xls', '.bmp']),
})

export type DriveConfig = z.infer<typeof DriveConfigSchema>

// ---------------------------------------------------------------------------
// Mail Bridge schema — compartido entre ConfigSchema y el runtime para
// extenderlo con el passwordResolver (inyectado por buildServer, no por env).
// ---------------------------------------------------------------------------
export const MailBridgeSchema = z
  .object({
    user: z
      .string()
      .min(1, 'PROTON_BRIDGE_USER is required when mail is enabled'),
    pass: z.string().default(''),
    // Path en el password store de Pass desde el que resolver la contraseña
    // JIT. Si se define y PROTON_PASS_ENABLED=true, `pass` puede estar vacío.
    passPath: z.string().optional(),
    host: z.string().default('127.0.0.1'),
    imapPort: z.number().int().positive().default(1143),
    smtpPort: z.number().int().positive().default(1025),
    from: z.string().email('PROTON_MAIL_FROM must be a valid email'),
    tlsInsecure: z.boolean().default(true),
    smtpSecurity: z.enum(['starttls', 'implicit', 'plain']).default('starttls'),
  })
  .refine((data) => data.pass.length > 0 || !!data.passPath, {
    message:
      'PROTON_BRIDGE_PASS or PROTON_BRIDGE_PASS_PATH is required when mail is enabled',
  })

const ConfigSchema = z.object({
  products: z.object({
    mail: z.object({
      enabled: z.boolean().default(true),
      bridge: MailBridgeSchema,
    }),
    pass: z.object({
      enabled: z.boolean().default(false),
      storeDir: z.string().default('~/.password-store'),
      // Path en el store del que resolver la contraseña de Bridge si
      // PROTON_BRIDGE_PASS no está configurada directamente.
      bridgePath: z.string().optional(),
    }),
    calendar: z.object({
      enabled: z.boolean().default(false),
    }),
    drive: DriveConfigSchema,
  }),
  transport: z.object({
    kind: z.enum(['stdio', 'http']).default('stdio'),
    httpHost: z.string().default('127.0.0.1'),
    httpPort: z.number().int().positive().default(8787),
    authToken: z.string().optional(),
    allowedOrigins: z.array(z.string()).default([]),
  }),
  alerts: z.object({
    webhookUrl: z.string().url().optional(),
    minSeverity: z
      .enum(['info', 'warning', 'alert', 'critical'])
      .default('warning'),
    logDir: z.string().default('logs'),
    enabled: z.boolean().default(true),
  }),
  agent: z.object({
    dryRun: z.boolean().default(true),
    maxInspectEmails: z.number().int().positive().default(1000),
    minConfidence: z.number().min(0).max(1).default(0.6),
  }),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
})

export type Config = z.infer<typeof ConfigSchema>
export type BridgeConfig = z.infer<typeof MailBridgeSchema>
export type ResolvedBridgeConfig = BridgeConfig & {
  passwordResolver: () => Promise<string>
}

/**
 * Resuelve el BridgeConfig a un ResolvedBridgeConfig con JIT password.
 * Si Pass está habilitado y hay passPath, usa PassClient. Si no, fallback a env var.
 */
export async function resolveBridgeConfig(
  cfg: Config,
  log: {
    debug: (m: string, e?: unknown) => void
    info: (m: string, e?: unknown) => void
    warn?: (m: string, e?: unknown) => void
    error?: (m: string, e?: unknown) => void
  },
): Promise<ResolvedBridgeConfig> {
  const bridge = cfg.products.mail.bridge
  if (cfg.products.pass.enabled && bridge.passPath) {
    const { PassClient } = await import('./pass.js')
    const passLog = {
      debug: log.debug,
      info: log.info,
      warn: log.warn ?? log.debug,
      error: log.error ?? log.info,
    }
    const passClient = new PassClient(
      { storeDir: cfg.products.pass.storeDir },
      passLog,
    )
    return {
      ...bridge,
      passwordResolver: () => passClient.get(bridge.passPath!),
    }
  }
  return {
    ...bridge,
    passwordResolver: () => Promise.resolve(bridge.pass),
  }
}

// ---------------------------------------------------------------------------
// Helpers de lectura de env vars
// ---------------------------------------------------------------------------

function readInt(value: string | undefined, defaultValue: number): number {
  return Number(value ?? defaultValue)
}

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  return (value ?? String(defaultValue)) === 'true'
}

function readCsv(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
}

// ---------------------------------------------------------------------------
// Parsers por bloque
// ---------------------------------------------------------------------------

function parseBridgeConfig(env: NodeJS.ProcessEnv) {
  return {
    user: (env.PROTON_BRIDGE_USER ?? '').trim(),
    pass: (env.PROTON_BRIDGE_PASS ?? '').trim(),
    passPath: env.PROTON_BRIDGE_PASS_PATH || undefined,
    host: env.PROTON_BRIDGE_HOST ?? '127.0.0.1',
    imapPort: readInt(env.PROTON_BRIDGE_IMAP_PORT, 1143),
    smtpPort: readInt(env.PROTON_BRIDGE_SMTP_PORT, 1025),
    from: (env.PROTON_MAIL_FROM ?? env.PROTON_BRIDGE_USER ?? '').trim(),
    tlsInsecure: readBool(env.PROTON_BRIDGE_TLS_INSECURE, true),
    smtpSecurity: (env.PROTON_BRIDGE_SMTP_SECURITY ?? 'starttls') as
      'starttls' | 'implicit' | 'plain',
  }
}

function parseProductsConfig(env: NodeJS.ProcessEnv) {
  const driveRcloneRemote = env.DRIVE_RCLONE_REMOTE || undefined
  return {
    mail: {
      enabled: readBool(env.PROTON_MAIL_ENABLED, true),
      bridge: parseBridgeConfig(env),
    },
    pass: {
      enabled: readBool(env.PROTON_PASS_ENABLED, false),
      storeDir: env.PROTON_PASS_STORE_DIR ?? '~/.password-store',
      bridgePath: env.PROTON_PASS_BRIDGE_PATH || undefined,
    },
    calendar: {
      enabled: readBool(env.PROTON_CALENDAR_ENABLED, false),
    },
    drive: {
      enabled: !!driveRcloneRemote,
      rcloneRemote: driveRcloneRemote,
      stagingDir: env.DRIVE_STAGING_DIR ?? '~/.protonmail/drive/',
      syncMode: (env.DRIVE_SYNC_MODE ?? 'pull') as 'pull' | 'watch',
      rcloneBin: env.DRIVE_RCLONE_BIN ?? 'rclone',
      obsoleteExtensions:
        readCsv(env.DRIVE_OBSOLETE_EXTENSIONS).length > 0
          ? readCsv(env.DRIVE_OBSOLETE_EXTENSIONS)
          : ['.doc', '.ppt', '.xls', '.bmp'],
    },
  }
}

function parseTransportConfig(env: NodeJS.ProcessEnv) {
  return {
    kind: (env.MCP_TRANSPORT ?? 'stdio') as 'stdio' | 'http',
    httpHost: env.MCP_HTTP_HOST ?? '127.0.0.1',
    httpPort: readInt(env.MCP_HTTP_PORT, 8787),
    authToken: env.MCP_AUTH_TOKEN || undefined,
    allowedOrigins: readCsv(env.MCP_ALLOWED_ORIGINS),
  }
}

function parseLogLevel(env: NodeJS.ProcessEnv) {
  return (env.LOG_LEVEL ?? 'info') as 'error' | 'warn' | 'info' | 'debug'
}

function parseAlertConfig(env: NodeJS.ProcessEnv) {
  return {
    webhookUrl: env.ALERT_WEBHOOK_URL || undefined,
    minSeverity: (env.ALERT_MIN_SEVERITY ??
      'warning') as Config['alerts']['minSeverity'],
    logDir: env.ALERT_LOG_DIR ?? 'logs',
    enabled: readBool(env.ALERTS_ENABLED, true),
  }
}

function parseAgentConfig(env: NodeJS.ProcessEnv) {
  return {
    dryRun: readBool(env.AGENT_DRY_RUN, true),
    maxInspectEmails: readInt(env.AGENT_MAX_INSPECT_EMAILS, 1000),
    minConfidence: Number(env.AGENT_MIN_CONFIDENCE ?? '0.6'),
  }
}

export function loadConfig(): Config {
  const env = process.env
  const raw = {
    products: parseProductsConfig(env),
    transport: parseTransportConfig(env),
    alerts: parseAlertConfig(env),
    agent: parseAgentConfig(env),
    logLevel: parseLogLevel(env),
  }
  return ConfigSchema.parse(raw)
}

export function mailBridge(cfg: Config): Config['products']['mail']['bridge'] {
  return cfg.products.mail.bridge
}

export function isDryRun(cfg: Config): boolean {
  return cfg.agent.dryRun
}

// -----------------------------------------------------------------------------
// Logger
// -----------------------------------------------------------------------------
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const
export type LogLevel = keyof typeof LEVELS

export function createLogger(level: LogLevel) {
  const threshold = LEVELS[level]
  const write = (lvl: LogLevel, msg: string, extra?: unknown) => {
    if (LEVELS[lvl] > threshold) return
    const ts = new Date().toISOString()
    const tail = extra === undefined ? '' : ` ${safeStringify(extra)}`
    process.stderr.write(`[${ts}] ${lvl.toUpperCase()} ${msg}${tail}\n`)
  }
  return {
    error: (msg: string, extra?: unknown) => {
      write('error', msg, extra)
    },
    warn: (msg: string, extra?: unknown) => {
      write('warn', msg, extra)
    },
    info: (msg: string, extra?: unknown) => {
      write('info', msg, extra)
    },
    debug: (msg: string, extra?: unknown) => {
      write('debug', msg, extra)
    },
  }
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v)
  } catch {
    return String(v)
  }
}
