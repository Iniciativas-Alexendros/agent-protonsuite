/**
 * Configuración y logger del servidor.
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
 */
import { z } from "zod";

const ConfigSchema = z.object({
  bridge: z.object({
    user: z.string().min(1, "PROTON_BRIDGE_USER is required"),
    pass: z.string().min(1, "PROTON_BRIDGE_PASS is required"),
    // Bridge escucha en 127.0.0.1 por defecto; en docker-compose el nombre
    // del servicio (`bridge`) reemplaza la IP local.
    host: z.string().default("127.0.0.1"),
    imapPort: z.number().int().positive().default(1143),
    smtpPort: z.number().int().positive().default(1025),
    // El `from` puede diferir del usuario autenticado si la cuenta tiene
    // alias. Si no se configura, cae al user.
    from: z.string().email("PROTON_MAIL_FROM must be a valid email"),
    // Bridge usa un cert autofirmado en localhost. `true` (default) acepta
    // sin validar. Poner a `false` sólo si importas la CA de Bridge al
    // trust store del contenedor/host.
    tlsInsecure: z.boolean().default(true),
    // Estrategia TLS del SMTP. Proton Bridge habla STARTTLS en 1025, así que
    // `starttls` (default) preserva el comportamiento histórico. `implicit`
    // (SMTPS, secure:true) e `plain` (sin TLS) existen para interoperar con
    // otros servidores SMTP — p. ej. GreenMail en los tests E2E. No afecta a
    // Bridge mientras se quede en el default.
    smtpSecurity: z.enum(["starttls", "implicit", "plain"]).default("starttls"),
  }),
  transport: z.object({
    kind: z.enum(["stdio", "http"]).default("stdio"),
    httpHost: z.string().default("127.0.0.1"),
    httpPort: z.number().int().positive().default(8787),
    // Bearer obligatorio en modo HTTP. Se compara timing-safe en `auth.ts`.
    authToken: z.string().optional(),
    // Allowlist de `Origin`. Lista vacía = no se valida (sólo bearer). En
    // producción (`NODE_ENV=production`) el server se niega a arrancar con
    // lista vacía, ver `index.ts`.
    allowedOrigins: z.array(z.string()).default([]),
  }),
  alerts: z.object({
    // URL para enviar alertas de contenido vía POST. Si no está configurada,
    // solo se escriben a fichero y stderr.
    webhookUrl: z.string().url().optional(),
    // Severidad mínima que dispara salida a fichero/webhook. stderr refleja
    // info en adelante si LOG_LEVEL lo permite.
    minSeverity: z.enum(["info", "warning", "alert", "critical"]).default("warning"),
    // Directorio donde se escriben logs de alertas y auditoría.
    logDir: z.string().default("logs"),
    // Activar o desactivar el sistema de alertas por completo.
    enabled: z.boolean().default(true),
  }),
  agent: z.object({
    // Los pipelines de organización/setup presentan el plan sin aplicarlo.
    // Poner a false solo cuando el operador haya validado el comportamiento.
    dryRun: z.boolean().default(true),
    // Máximo de correos inspeccionados en un análisis de organización.
    maxInspectEmails: z.number().int().positive().default(1000),
    // Confianza mínima (0-1) para aceptar una clasificación propuesta.
    minConfidence: z.number().min(0).max(1).default(0.6),
  }),
  logLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Lee un entero de env; cae al default si no está definido. Zod valida. */
function readInt(value: string | undefined, defaultValue: number): number {
  return Number(value ?? defaultValue);
}

/** Lee un booleano de env representado como "true" / "false". */
function readBool(value: string | undefined, defaultValue: boolean): boolean {
  return (value ?? String(defaultValue)) === "true";
}

/** CSV → array, normalizando whitespace y descartando entradas vacías. */
function readCsv(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/** Lee el bloque de configuración de Proton Mail Bridge desde `process.env`. */
function parseBridgeConfig(env: NodeJS.ProcessEnv): Config["bridge"] {
  return {
    user: env.PROTON_BRIDGE_USER ?? "",
    pass: env.PROTON_BRIDGE_PASS ?? "",
    host: env.PROTON_BRIDGE_HOST ?? "127.0.0.1",
    imapPort: readInt(env.PROTON_BRIDGE_IMAP_PORT, 1143),
    smtpPort: readInt(env.PROTON_BRIDGE_SMTP_PORT, 1025),
    from: env.PROTON_MAIL_FROM ?? env.PROTON_BRIDGE_USER ?? "",
    tlsInsecure: readBool(env.PROTON_BRIDGE_TLS_INSECURE, true),
    smtpSecurity: (env.PROTON_BRIDGE_SMTP_SECURITY ?? "starttls") as
      | "starttls"
      | "implicit"
      | "plain",
  };
}

/** Lee el bloque de transporte MCP (stdio / HTTP) desde `process.env`. */
function parseTransportConfig(env: NodeJS.ProcessEnv): Config["transport"] {
  return {
    kind: (env.MCP_TRANSPORT ?? "stdio") as "stdio" | "http",
    httpHost: env.MCP_HTTP_HOST ?? "127.0.0.1",
    httpPort: readInt(env.MCP_HTTP_PORT, 8787),
    authToken: env.MCP_AUTH_TOKEN || undefined,
    allowedOrigins: readCsv(env.MCP_ALLOWED_ORIGINS),
  };
}

/** Lee y valida el nivel de log desde `process.env`. */
function parseLogLevel(
  env: NodeJS.ProcessEnv,
): Config["logLevel"] {
  return (env.LOG_LEVEL ?? "info") as "error" | "warn" | "info" | "debug";
}

/** Lee el bloque de configuración de alertas desde `process.env`. */
function parseAlertConfig(env: NodeJS.ProcessEnv): Config["alerts"] {
  return {
    webhookUrl: env.ALERT_WEBHOOK_URL || undefined,
    minSeverity: (env.ALERT_MIN_SEVERITY ?? "warning") as Config["alerts"]["minSeverity"],
    logDir: env.ALERT_LOG_DIR ?? "logs",
    enabled: readBool(env.ALERTS_ENABLED, true),
  };
}

/** Lee el bloque de configuración del agente desde `process.env`. */
function parseAgentConfig(env: NodeJS.ProcessEnv): Config["agent"] {
  return {
    dryRun: readBool(env.AGENT_DRY_RUN, true),
    maxInspectEmails: readInt(env.AGENT_MAX_INSPECT_EMAILS, 1000),
    minConfidence: Number(env.AGENT_MIN_CONFIDENCE ?? "0.6"),
  };
}

/**
 * Lee `process.env` y lo pasa por Zod. La separación entre "lectura cruda" y
 * "parseo" hace trivial testear el schema desde `tests/config.test.ts`:
 * basta con mutar `process.env` y volver a llamar a `loadConfig()`.
 */
export function loadConfig(): Config {
  const env = process.env;
  const raw = {
    bridge: parseBridgeConfig(env),
    transport: parseTransportConfig(env),
    alerts: parseAlertConfig(env),
    agent: parseAgentConfig(env),
    logLevel: parseLogLevel(env),
  };
  return ConfigSchema.parse(raw);
}

// -----------------------------------------------------------------------------
// Logger
//
// stderr-only por diseño. Formato `[ISO] LEVEL message {extra-json}` — fácil de
// grepear en `docker logs` y suficientemente estructurado para awk/jq.
// -----------------------------------------------------------------------------
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
export type LogLevel = keyof typeof LEVELS;

export function createLogger(level: LogLevel) {
  const threshold = LEVELS[level];
  const write = (lvl: LogLevel, msg: string, extra?: unknown) => {
    if (LEVELS[lvl] > threshold) return;
    const ts = new Date().toISOString();
    const tail = extra === undefined ? "" : ` ${safeStringify(extra)}`;
    process.stderr.write(`[${ts}] ${lvl.toUpperCase()} ${msg}${tail}\n`);
  };
  return {
    error: (msg: string, extra?: unknown) => write("error", msg, extra),
    warn: (msg: string, extra?: unknown) => write("warn", msg, extra),
    info: (msg: string, extra?: unknown) => write("info", msg, extra),
    debug: (msg: string, extra?: unknown) => write("debug", msg, extra),
  };
}

/** Stringify tolerante: objetos circulares o no serializables caen a `String(v)`. */
function safeStringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
