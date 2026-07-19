/**
 * Schema de configuración de Proton Drive.
 *
 * Extraído de src/config.ts para reducir el tamaño de la fachada principal.
 * Sin dependencias circulares — solo importa zod.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Drive schema — proton-drive CLI backend, configurable por env vars.
// ---------------------------------------------------------------------------
export const DriveConfigSchema = z.object({
  enabled: z.boolean().default(false),
  cliBin: z.string().default('proton-drive'),
  stagingDir: z.string().default('~/.proton-drive/staging'),
  obsoleteExtensions: z
    .array(z.string())
    .default(['.doc', '.ppt', '.xls', '.bmp']),
})

export type DriveConfig = z.infer<typeof DriveConfigSchema>

/** Parsea Drive config desde env vars. */
export function parseDriveConfig(env: NodeJS.ProcessEnv) {
  const readCsv = (value: string | undefined): string[] =>
    value
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  const obsoleteExt =
    readCsv(env['DRIVE_OBSOLETE_EXTENSIONS']).length > 0
      ? readCsv(env['DRIVE_OBSOLETE_EXTENSIONS'])
      : ['.doc', '.ppt', '.xls', '.bmp']

  return {
    enabled: (env['DRIVE_ENABLED'] ?? 'true') === 'true',
    cliBin: env['DRIVE_CLI_BIN'] ?? 'proton-drive',
    stagingDir: env['DRIVE_STAGING_DIR'] ?? '~/.proton-drive/staging',
    obsoleteExtensions: obsoleteExt,
  }
}
