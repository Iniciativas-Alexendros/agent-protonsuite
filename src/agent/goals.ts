import type { AgentGoal, GoalContext } from "./types.js";

const ALLOWED_GOALS: AgentGoal[] = ["discover", "setup", "check-imap", "organize", "monitor", "alert"];

export function parseGoal(value: string | undefined): AgentGoal {
  const g = (value ?? "setup") as AgentGoal;
  if (!ALLOWED_GOALS.includes(g)) {
    throw new Error(`Unknown agent goal: ${value}. Allowed: ${ALLOWED_GOALS.join(", ")}`);
  }
  return g;
}

export function buildGoalContext(goal: AgentGoal, cfg: { dryRun: boolean; maxInspectEmails: number; minConfidence: number }): GoalContext {
  return {
    goal,
    dryRun: cfg.dryRun,
    maxInspectEmails: cfg.maxInspectEmails,
    minConfidence: cfg.minConfidence,
  };
}

export function describeGoal(goal: AgentGoal): string {
  const map: Record<AgentGoal, string> = {
    discover: "Descubre el estado actual del buzón sin realizar cambios.",
    setup: "Verifica la conectividad con Bridge y autenticación, reportando estado.",
    "check-imap": "Verifica únicamente la conexión IMAP con Bridge sin enviar email.",
    organize: "Analiza el buzón y propone/crea carpetas, etiquetas y archivado.",
    monitor: "Revisa el buzón buscando alertas de seguridad sin realizar cambios.",
    alert: "Revisa y emite alertas para correos de alto riesgo.",
  };
  return map[goal];
}
