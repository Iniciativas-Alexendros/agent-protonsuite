/**
 * Barrel export para src/config/*.
 *
 * Re-exporta todo lo expuesto por la fachada principal (src/config.ts),
 * además de los submódulos individuales para imports directos.
 *
 * Uso recomendado:
 *   import { Config, createLogger, loadConfig } from './config/index.js'
 *   import { DriveConfigSchema } from './config/drive.js'
 */
export {
  // Fachada principal
  loadConfig,
  createLogger,
  resolveBridgeConfig,
  mailBridge,
  isDryRun,
  // Schemas (re-exportados desde submódulos)
  MailBridgeSchema,
  DriveConfigSchema,
  PassConfigSchema,
  CalendarConfigSchema,
  // Parsers (re-exportados desde submódulos)
  parseBridgeConfig,
  parseDriveConfig,
  parsePassConfig,
  parseCalendarConfig,
} from '../config.js'

export type {
  Config,
  BridgeConfig,
  ResolvedBridgeConfig,
  DriveConfig,
  PassConfig,
  CalendarConfig,
  LogLevel,
} from '../config.js'
