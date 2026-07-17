import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createLogger } from '../config.js'
import { getBinaryInfo, REGISTRY } from '../ecosystem/binaries.js'
import { checkAllBinaries } from '../ecosystem/discovery.js'
import { buildInstallPlan } from '../ecosystem/installer.js'
import { checkUpdateFor } from '../ecosystem/updater.js'

type Logger = ReturnType<typeof createLogger>

export function registerEcosystemTools(
  server: McpServer,
  _deps: { log: Logger },
) {

  server.registerTool(
    'proton_ecosystem_discover',
    {
      title: 'Discover Proton ecosystem binaries',
      description:
        'Which Proton product binaries are installed and their auth status.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ response_format }) => {
      const all = checkAllBinaries()
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(all, null, 2) }],
          structuredContent: { binaries: all },
        }
      }
      const lines = ['# Proton Ecosystem - Estado de binarios']
      for (const b of all) {
        lines.push('')
        lines.push(`- ${b.name}`)
        lines.push(`  Instalado: ${b.installed ? 'si' : 'no'}`)
        if (b.version) lines.push(`  Version: ${b.version}`)
        if (b.authenticated !== undefined)
          lines.push(`  Autenticado: ${b.authenticated ? 'si' : 'no'}`)
        if (b.error) lines.push(`  Error: ${b.error}`)
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.registerTool(
    'proton_ecosystem_health',
    {
      title: 'Ecosystem health check',
      description:
        'Unified health status of all Proton ecosystem binaries. Returns a concise pass/fail summary.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ response_format }) => {
      const all = checkAllBinaries()
      const healthy = all.filter((b) => b.installed && b.authenticated !== false)
      const unhealthy = all.filter(
        (b) => !b.installed || b.authenticated === false,
      )
      if (response_format === 'json') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ healthy, unhealthy }, null, 2),
            },
          ],
          structuredContent: { healthy, unhealthy },
        }
      }
      const lines = [
        '# Proton Ecosystem - Health',
        `Healthy: ${healthy.length}/${all.length}`,
        '',
        ...all.map((b) => {
          const status = b.installed
            ? b.authenticated === false
              ? 'auth failed'
              : 'ok'
            : 'missing'
          return `- ${b.name}: ${status}`
        }),
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.registerTool(
    'proton_ecosystem_check_updates',
    {
      title: 'Check for updates',
      description: 'Available version updates for Proton binaries.',
      inputSchema: {
        product: z.enum(['bridge', 'pass', 'drive']).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ product }) => {
      const targets = product
        ? REGISTRY.filter((b) => b.product === product)
        : REGISTRY
      const results = targets.map((b) => checkUpdateFor(b))
      const lines = ['# Proton Ecosystem Updates']
      for (const r of results) {
        lines.push(
          `- ${r.product}: ${r.currentVersion ?? 'N/A'} → ${r.latestVersion ?? '?'} ${r.updatable ? '[UPDATE]' : '[OK]'}`,
        )
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.registerTool(
    'proton_ecosystem_install',
    {
      title: 'Install Proton product',
      description: 'Instructions for installing a Proton product binary.',
      inputSchema: {
        product: z.enum(['bridge', 'pass', 'drive', 'gpg']).default('drive'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ product }) => {
      const info = getBinaryInfo(product)
      if (!info)
        return {
          content: [{ type: 'text', text: 'Unknown product: ' + product }],
          isError: true,
        }
      const plan = buildInstallPlan(info)
      return {
        content: [
          {
            type: 'text',
            text: ['# Installing ' + info.name, '', ...(plan.steps ?? [])].join(
              '\n',
            ),
          },
        ],
      }
    },
  )
}
