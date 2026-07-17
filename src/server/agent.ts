import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  buildOrganizationPlan,
  buildGoalContext,
  parseGoal,
} from '../agent/index.js'
import type { AlertSystem } from '../alerts/index.js'
import type { createLogger, Config } from '../config.js'

type Logger = ReturnType<typeof createLogger>

export function registerAgentTools(
  server: McpServer,
  deps: { cfg: Config; log: Logger; alerts: AlertSystem },
) {
  const { cfg, log, alerts } = deps

  server.registerTool(
    'proton_agent_plan',
    {
      title: 'Get agent organization/alert plan',
      description:
        'Analyzes the mailbox using the embedded agent rules and returns a proposed folder/label structure plus content alerts. This is a read-only planning tool; it does not move, flag or delete emails. Use it before running the CLI agent:organize command.',
      inputSchema: {
        goal: z
          .enum(['organize', 'monitor', 'alert'])
          .default('organize')
          .describe(
            'Agent goal: organize (propose folders/labels), monitor (inspect only), alert (threats only).',
        ),
        response_format: z
          .enum(['markdown', 'json'])
          .default('json')
          .describe(
            'Output format. JSON is recommended for programmatic consumers.',
          ),
      },
      outputSchema: {
        newFolders: z.array(z.string()),
        folderProposals: z.array(
          z.object({
            path: z.string(),
            reason: z.string(),
            emails: z.array(z.number()),
          }),
        ),
        labelProposals: z.array(
          z.object({
            name: z.string(),
            reason: z.string(),
            emails: z.array(z.number()),
          }),
        ),
        alerts: z.array(
          z.object({
            severity: z.enum(['info', 'warning', 'alert', 'critical']),
            category: z.string(),
            message: z.string(),
            uids: z.array(z.number()),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async ({ goal, response_format }) => {
      const ctx = buildGoalContext(parseGoal(goal), cfg.agent)
      // Force read-only: even if the operator disabled dryRun, this tool never writes.
      const readOnlyCtx = { ...ctx, dryRun: true }
      const plan = await buildOrganizationPlan(cfg, readOnlyCtx, log, alerts)
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
          structuredContent: plan,
        }
      }
      const lines = [
        `# Plan del agente (${goal})`,
        '',
        '## Carpetas propuestas',
        ...plan.newFolders.map((f) => `- **${f}** (nueva)`),
        '',
        '## Movimientos propuestos',
        ...plan.folderProposals.map(
          (p) => `- ${p.path}: ${p.emails.length} correos — ${p.reason}`,
        ),
        '',
        '## Etiquetas propuestas',
        ...plan.labelProposals.map(
          (p) => `- ${p.name}: ${p.emails.length} correos — ${p.reason}`,
        ),
        '',
        '## Alertas',
        ...plan.alerts.map((a) => `- [${a.severity}] ${a.message}`),
      ]
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: plan,
      }
    },
  )
}
