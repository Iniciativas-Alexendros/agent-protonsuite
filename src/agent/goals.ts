import type { AgentGoal, GoalContext } from './types.js'

const ALLOWED_GOALS: AgentGoal[] = [
  'discover',
  'setup',
  'check-imap',
  'organize',
  'monitor',
  'alert',
  'pass-audit',
  'suite-status',
  'drive-audit',
  'drive-organize',
  'drive-sync',
]

export function parseGoal(value: string | undefined): AgentGoal {
  const g = (value ?? 'setup') as AgentGoal
  if (!ALLOWED_GOALS.includes(g)) {
    throw new Error(
      `Unknown agent goal: ${value}. Allowed: ${ALLOWED_GOALS.join(', ')}`,
    )
  }
  return g
}

export function buildGoalContext(
  goal: AgentGoal,
  cfg: { dryRun: boolean; maxInspectEmails: number; minConfidence: number },
): GoalContext {
  return {
    goal,
    dryRun: cfg.dryRun,
    maxInspectEmails: cfg.maxInspectEmails,
    minConfidence: cfg.minConfidence,
  }
}

export function describeGoal(goal: AgentGoal): string {
  const map: Record<AgentGoal, string> = {
    discover: 'Descubre el estado actual del buzón sin realizar cambios.',
    setup:
      'Verifica la conectividad con Bridge y autenticación, reportando estado.',
    'check-imap':
      'Verifica únicamente la conexión IMAP con Bridge sin enviar email.',
    organize:
      'Analiza el buzón y propone/crea carpetas, etiquetas y archivado.',
    monitor:
      'Revisa el buzón buscando alertas de seguridad sin realizar cambios.',
    alert: 'Revisa y emite alertas para correos de alto riesgo.',
    'pass-audit':
      'Audita el vault de Proton Pass: fortaleza de contraseñas, duplicados y rotación pendiente.',
    'suite-status':
      'Reporte unificado del estado de todos los productos configurados (Mail, Pass, Calendar, Drive).',
    'drive-audit':
      'Escanea el staging de ProtonDrive: inventario, duplicados, formatos obsoletos. Read-only.',
    'drive-organize':
      'Analiza y reorganiza archivos en el staging por tipo. Dry-run por defecto.',
    'drive-sync':
      'Sincroniza el staging con ProtonDrive (pull por defecto; push manual vía proton_drive_sync direction=push).',
  }
  return map[goal]
}
