export { runAgent } from "./executor.js";
export { parseGoal, describeGoal, buildGoalContext } from "./goals.js";
export { runSetup, runImapCheck } from "./setup.js";
export { buildOrganizationPlan, applyOrganizationPlan } from "./organizer.js";
export type { AgentGoal, GoalContext, SetupReport, OrganizationPlan } from "./goals.js";
