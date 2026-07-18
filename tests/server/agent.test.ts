/**
 * Tests para src/server/agent.ts (64.89% → objetivo ~95%).
 *
 * registerAgentTools registra 1 tool: proton_agent_plan.
 * Mockea buildOrganizationPlan, buildGoalContext, parseGoal.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerAgentTools } from '../../src/server/agent.js'

const hoisted = vi.hoisted(() => {
  const mockBuildOrganizationPlan = vi.fn()
  const mockBuildGoalContext = vi.fn()
  const mockParseGoal = vi.fn()

  const silentLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
  const mockAlerts = { emit: vi.fn() } as never

  return {
    mockBuildOrganizationPlan, mockBuildGoalContext, mockParseGoal,
    silentLog, mockAlerts,
  }
})

vi.mock('../../src/agent/index.js', () => ({
  buildOrganizationPlan: hoisted.mockBuildOrganizationPlan,
  buildGoalContext: hoisted.mockBuildGoalContext,
  parseGoal: hoisted.mockParseGoal,
}))

const defaultCfg = {
  agent: { dryRun: true, classifyRules: [], categories: [] },
} as never

beforeEach(() => { vi.clearAllMocks() })

type ToolHandler = (args: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[]
    isError?: boolean
    structuredContent?: Record<string, unknown>
  }>

function captureHandler() {
  const handlers = new Map<string, ToolHandler>()
  const server = {
    registerTool: vi.fn((name: string, _schema: unknown, handler: ToolHandler) => {
      handlers.set(name, handler)
    }),
  } as unknown as McpServer
  return {
    server,
    invoke: async (toolName: string, args: Record<string, unknown> = {}) => {
      const handler = handlers.get(toolName)
      if (!handler) throw new Error(`Tool "${toolName}" not registered`)
      return handler(args)
    },
  }
}

function register(server: McpServer) {
  registerAgentTools(server, { cfg: defaultCfg, log: hoisted.silentLog, alerts: hoisted.mockAlerts })
}

describe('registerAgentTools', () => {
  const samplePlan = {
    newFolders: ['Legal', 'Admin'],
    folderProposals: [{ path: 'Legal', reason: 'Contrato legal', emails: [1, 2] }],
    labelProposals: [{ name: 'urgente', reason: 'Vence hoy', emails: [3] }],
    alerts: [{ severity: 'warning', category: 'Vencimiento', message: 'Contrato vence', uids: [1] }],
  }

  describe('proton_agent_plan', () => {
    it('devuelve JSON por defecto (response_format=json)', async () => {
      hoisted.mockParseGoal.mockReturnValue('organize')
      hoisted.mockBuildGoalContext.mockReturnValue({ dryRun: true })
      hoisted.mockBuildOrganizationPlan.mockResolvedValue(samplePlan)

      const { server, invoke } = captureHandler()
      register(server)

      // Nota: response_format se pasa explícitamente (handler bypassa Zod)
      const result = await invoke('proton_agent_plan', { goal: 'organize', response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.newFolders).toEqual(['Legal', 'Admin'])
      expect(parsed.folderProposals).toHaveLength(1)
      expect(result.structuredContent).toBeDefined()
    })

    it('devuelve markdown con goal específico', async () => {
      hoisted.mockParseGoal.mockReturnValue('monitor')
      hoisted.mockBuildGoalContext.mockReturnValue({ dryRun: true })
      hoisted.mockBuildOrganizationPlan.mockResolvedValue(samplePlan)

      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_agent_plan', { goal: 'monitor', response_format: 'markdown' })
      const text = result.content[0].text
      expect(text).toContain('Plan del agente')
      expect(text).toContain('(monitor)')
      expect(text).toContain('Legal')
      expect(text).toContain('Contrato legal')
      expect(text).toContain('urgente')
      expect(text).toContain('[warning]')
    })

    it('fuerza dryRun=true aunque el goal context tenga dryRun=false', async () => {
      hoisted.mockParseGoal.mockReturnValue('organize')
      hoisted.mockBuildGoalContext.mockReturnValue({ dryRun: false })
      hoisted.mockBuildOrganizationPlan.mockResolvedValue(samplePlan)

      const { server, invoke } = captureHandler()
      register(server)

      await invoke('proton_agent_plan', { goal: 'organize' })
      // readOnlyCtx debe tener dryRun: true
      const ctxArg = hoisted.mockBuildOrganizationPlan.mock.calls[0][1]
      expect(ctxArg.dryRun).toBe(true)
    })

    it('pasa goal=alert y parseGoal correctamente', async () => {
      hoisted.mockParseGoal.mockReturnValue('alert')
      hoisted.mockBuildGoalContext.mockReturnValue({ dryRun: true })
      hoisted.mockBuildOrganizationPlan.mockResolvedValue({
        newFolders: [], folderProposals: [], labelProposals: [],
        alerts: [{ severity: 'critical', category: 'Phishing', message: 'Phishing detected', uids: [5] }],
      })

      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_agent_plan', { goal: 'alert', response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.alerts).toHaveLength(1)
      expect(parsed.alerts[0].severity).toBe('critical')
      expect(hoisted.mockParseGoal).toHaveBeenCalledWith('alert')
    })

    it('devuelve structuredContent en markdown', async () => {
      hoisted.mockParseGoal.mockReturnValue('organize')
      hoisted.mockBuildGoalContext.mockReturnValue({ dryRun: true })
      hoisted.mockBuildOrganizationPlan.mockResolvedValue(samplePlan)

      const { server, invoke } = captureHandler()
      register(server)

      const result = await invoke('proton_agent_plan', { goal: 'organize' })
      expect(result.structuredContent).toBeDefined()
    })
  })
})
