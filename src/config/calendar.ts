/**
 * Schema de configuración de Proton Calendar.
 *
 * Extraído de src/config.ts para reducir el tamaño de la fachada principal.
 * Sin dependencias circulares — solo importa zod.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Calendar config section — subobjeto de products.calendar en ConfigSchema.
// ---------------------------------------------------------------------------
export const CalendarConfigSchema = z.object({
  enabled: z.boolean().default(false),
})

export type CalendarConfig = z.infer<typeof CalendarConfigSchema>

/** Parsea Calendar config desde env vars. */
export function parseCalendarConfig(env: NodeJS.ProcessEnv) {
  return {
    enabled: (env['PROTON_CALENDAR_ENABLED'] ?? 'false') === 'true',
  }
}
