import { loadConfig, type Config } from "../config.js";
import { createLogger } from "../config.js";
import { AlertSystem } from "../alerts/index.js";
import { parseGoal, buildGoalContext, describeGoal } from "./goals.js";
import { runSetup } from "./setup.js";
import { buildOrganizationPlan, applyOrganizationPlan } from "./organizer.js";
import type { AgentGoal } from "./types.js";

export async function runAgent(goalName: AgentGoal | string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const goal = parseGoal(goalName as string);
  const cfg = loadConfig();
  const log = createLogger(cfg.logLevel);
  const alerts = new AlertSystem(cfg.alerts, log);
  await alerts.init();

  const ctx = buildGoalContext(goal, cfg.agent);
  log.info("agent goal", { goal, dryRun: ctx.dryRun, description: describeGoal(goal) });
  alerts.audit("agent-start", "agent/executor", { goal, dryRun: ctx.dryRun });

  switch (goal) {
    case "discover": {
      const report = await runSetup(cfg, log);
      log.info("discover report", { report });
      break;
    }
    case "setup": {
      const report = await runSetup(cfg, log);
      if (report.imapOk && report.smtpOk) {
        log.info("setup complete", { folders: report.folders.length });
      } else {
        log.error("setup incomplete", { recommendations: report.recommendations });
        process.exit(2);
      }
      break;
    }
    case "organize":
    case "monitor":
    case "alert": {
      const plan = await buildOrganizationPlan(cfg, ctx, log, alerts);
      if (goal === "monitor" || goal === "alert") {
        log.info("monitor/alert plan", {
          newFolders: plan.newFolders,
          folderProposals: plan.folderProposals.length,
          labelProposals: plan.labelProposals.length,
          alerts: plan.alerts.length,
        });
        break;
      }
      if (ctx.dryRun) {
        log.info("dry-run organization plan", plan);
        alerts.info("organize", "Plan de organización generado en modo dry-run; no se aplicaron cambios.", "agent/executor", {
          newFolders: plan.newFolders,
          folderProposals: plan.folderProposals.length,
          labelProposals: plan.labelProposals.length,
        });
      } else {
        await applyOrganizationPlan(cfg, plan, log);
        alerts.audit("organize-applied", "agent/executor", {
          newFolders: plan.newFolders,
          folderProposals: plan.folderProposals.length,
          labelProposals: plan.labelProposals.length,
        });
      }
      break;
    }
  }

  alerts.audit("agent-end", "agent/executor", { goal });
}

export { loadConfig };
export type { Config };
