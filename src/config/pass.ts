/**
 * Schema de configuración de Proton Pass.
 *
 * Extraído de src/config.ts para reducir el tamaño de la fachada principal.
 * Sin dependencias circulares — solo importa zod.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Pass config section — subobjeto de products.pass en ConfigSchema.
// ---------------------------------------------------------------------------
export const PassConfigSchema = z.object({
  enabled: z.boolean().default(false),
  storeDir: z.string().default('~/.password-store'),
  // Path en el store del que resolver la contraseña de Bridge si
  // PROTON_BRIDGE_PASS no está configurada directamente.
  bridgePath: z.string().optional(),
})

export type PassConfig = z.infer<typeof PassConfigSchema>

/** Parsea Pass config desde env vars. */
export function parsePassConfig(env: NodeJS.ProcessEnv) {
  return {
    enabled: (env['PROTON_PASS_ENABLED'] ?? 'false') === 'true',
    storeDir: env['PROTON_PASS_STORE_DIR'] ?? '~/.password-store',
    bridgePath: env['PROTON_PASS_BRIDGE_PATH'] || undefined,
  }
}
