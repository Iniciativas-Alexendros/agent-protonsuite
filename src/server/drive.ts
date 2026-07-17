import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createLogger, Config } from '../config.js'
import { DriveAuditor } from '../drive-audit.js'
import type { DriveClient } from '../drive.js'

type Logger = ReturnType<typeof createLogger>

export function registerDriveTools(
  server: McpServer,
  deps: { cfg: Config; log: Logger; driveClient: DriveClient | undefined },
) {
  const { cfg, log, driveClient } = deps
  if (!cfg.products.drive.enabled || !driveClient) return
  const driveCfg = cfg.products.drive
  const auditor = new DriveAuditor(driveCfg.obsoleteExtensions, log)

  server.registerTool(
    'proton_drive_audit',
    {
      title: 'Audit Proton Drive content',
      description:
        'Scans the staging directory and returns an inventory report: total files, by type/size/date, duplicates, and obsolete formats.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
        staging_dir: z
          .string()
          .optional()
          .describe('Override staging directory path'),
      },
      outputSchema: {
        totalFiles: z.number(),
        totalBytes: z.number(),
        duplicates: z.array(
          z.object({
            hash: z.string(),
            size: z.number(),
            files: z.array(z.object({ path: z.string(), name: z.string() })),
          }),
        ),
        obsoleteFiles: z.array(
          z.object({
            name: z.string(),
            path: z.string(),
            ext: z.string(),
            size: z.number(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ response_format, staging_dir }) => {
      const staging = staging_dir
        ? resolve(staging_dir)
        : driveClient.stagingDir
      try {
        const inv = auditor.scanInventory(staging)
        const dups = auditor.findDuplicates(staging)
        const fmt = auditor.formatReport(staging)
        const structured = {
          totalFiles: inv.totalFiles,
          totalBytes: inv.totalBytes,
          duplicates: dups,
          obsoleteFiles: fmt.obsoleteFiles,
        }
        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(structured, null, 2) },
            ],
            structuredContent: structured,
          }
        }
        const lines = [
          `# Proton Drive Audit`,
          `**Total:** ${inv.totalFiles} files, ${(inv.totalBytes / 1024 / 1024).toFixed(1)} MB`,
          '',
          '## By extension',
          ...Object.entries(inv.byExt)
            .sort(([, a], [, b]) => b - a)
            .map(([ext, count]) => `- \`${ext || '(none)'}\`: ${count}`),
          dups.length > 0
            ? [
                '',
                '## Duplicates',
                ...dups.map(
                  (d) =>
                    `- ${d.hash.slice(0, 8)} (${d.files.length} copies): ${d.files.map((f) => f.name).join(', ')}`,
                ),
              ]
            : [],
          fmt.obsoleteFiles.length > 0
            ? [
                '',
                '## Obsolete formats',
                ...fmt.obsoleteFiles.map((f) => `- \`${f.path}\` (${f.ext})`),
              ]
            : [],
        ].flat()
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: structured,
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_status',
    {
      title: 'Proton Drive sync status',
      description:
        'Returns the current state of the proton-drive CLI binary and the local staging directory.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const st = await driveClient.status()
        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(st, null, 2) }],
            structuredContent: st as unknown as Record<string, unknown>,
          }
        }
        const lines = [
          '# Proton Drive Status',
          `- **CLI binary:** \`${st.cliPath}\``,
          `- **Authenticated:** ${st.authenticated === undefined ? 'n/a' : st.authenticated ? 'yes' : 'no'}`,
          `- **Staging exists:** ${st.stagingExists ? 'yes' : 'no'}`,
          st.stagingFiles !== undefined
            ? `- **Staging files:** ${st.stagingFiles}`
            : null,
          st.stagingBytes !== undefined
            ? `- **Staging bytes:** ${st.stagingBytes}`
            : null,
          st.error ? `- **Error:** ${st.error}` : null,
        ].filter((x) => x !== null)
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: st as unknown as Record<string, unknown>,
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_organize',
    {
      title: 'Organize files in Proton Drive',
      description:
        'Analyzes the staging directory and moves files into a structured folder layout (by type). Dry-run by default.',
      inputSchema: {
        dry_run: z
          .boolean()
          .default(true)
          .describe('If true, only shows the plan without moving files.'),
        staging_dir: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ dry_run, staging_dir }) => {
      const staging = staging_dir
        ? resolve(staging_dir)
        : driveClient.stagingDir
      try {
        const plan = auditor.buildOrganizePlan(staging)
        if (dry_run) {
          const lines = [
            '# Organize plan (dry-run)',
            '',
            '## Suggested moves:',
            ...plan.suggestions.map(
              (s) => `- \`${s.from}\` → \`${s.to}\` (${s.reason})`,
            ),
          ]
          return {
            content: [{ type: 'text', text: lines.join('\n') }],
            structuredContent: {
              dryRun: true,
              suggestions: plan.suggestions,
            },
          }
        }
        let moved = 0
        for (const s of plan.suggestions) {
          if (s.action === 'move') {
            const src = resolve(staging, s.from)
            const dst = resolve(staging, s.to)
            const dstDir = dirname(dst)
            if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
            renameSync(src, dst)
            moved++
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: `Moved ${moved} files. Run sync to push changes to ProtonDrive.`,
            },
          ],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_format_report',
    {
      title: 'Proton Drive format report',
      description:
        'Detailed analysis of file formats in the staging directory.',
      inputSchema: {
        staging_dir: z.string().optional(),
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ staging_dir, response_format }) => {
      const staging = staging_dir
        ? resolve(staging_dir)
        : driveClient.stagingDir
      try {
        const fmt = auditor.formatReport(staging)
        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(fmt, null, 2) }],
            structuredContent: fmt as unknown as Record<string, unknown>,
          }
        }
        const lines = [
          '# Proton Drive Format Report',
          `- **Total extensions:** ${fmt.totalExtensions}`,
          `- **Obsolete files:** ${fmt.obsoleteFiles.length}`,
          `- **Files without extension:** ${fmt.noExtension}`,
          '',
          '## Extensions',
          ...fmt.extensions.map((e) => `- \`${e || '(none)'}\``),
          fmt.obsoleteFiles.length > 0
            ? [
                '',
                '## Obsolete files',
                ...fmt.obsoleteFiles.map((f) => `- \`${f.path}\` (${f.ext})`),
              ]
            : [],
        ].flat()
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: fmt as unknown as Record<string, unknown>,
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_list_files',
    {
      title: 'List files on Proton Drive',
      description:
        'Lists the contents of a remote Proton Drive path using the proton-drive CLI. Read-only.',
      inputSchema: {
        remote_path: z
          .string()
          .default('/my-files')
          .describe('Remote path on Proton Drive, e.g. /my-files/Documents.'),
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ remote_path, response_format }) => {
      try {
        const r = await driveClient.listFiles(remote_path)
        if (!r.ok)
          return {
            isError: true,
            content: [{ type: 'text', text: `List failed: ${r.error}` }],
          }
        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(r.files, null, 2) },
            ],
            structuredContent: {
              remotePath: remote_path,
              count: r.files.length,
              files: r.files,
            },
          }
        }
        const lines = [
          `# Proton Drive \`${remote_path}\``,
          '',
          `- **Entries:** ${r.files.length}`,
          '',
          ...r.files.map(
            (f) =>
              `- \`${f.path ?? f.name ?? '(unknown)'}\`${f.size !== undefined ? ` (${f.size} bytes)` : ''}`,
          ),
        ]
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: {
            remotePath: remote_path,
            count: r.files.length,
            files: r.files,
          },
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_download',
    {
      title: 'Download from Proton Drive to staging',
      description:
        'Downloads a remote Proton Drive path into the local staging directory using the proton-drive CLI. Idempotent.',
      inputSchema: {
        remote_path: z
          .string()
          .default('/my-files')
          .describe('Remote path on Proton Drive to download.'),
        local_path: z
          .string()
          .optional()
          .describe(
            'Override staging directory locally. Defaults to configured stagingDir.',
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ remote_path, local_path }) => {
      try {
        const r = await driveClient.download(remote_path, local_path)
        if (!r.ok)
          return {
            isError: true,
            content: [{ type: 'text', text: `Download failed: ${r.error}` }],
          }
        return {
          content: [
            {
              type: 'text',
              text: `Downloaded \`${r.remotePath}\` → \`${r.localPath}\``,
            },
          ],
          structuredContent: { ...r },
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_upload',
    {
      title: 'Upload staging to Proton Drive',
      description:
        'Uploads the local staging directory to a remote Proton Drive path using the proton-drive CLI.',
      inputSchema: {
        local_path: z
          .string()
          .optional()
          .describe('Override staging directory locally.'),
        remote_path: z
          .string()
          .default('/my-files')
          .describe('Remote destination path on Proton Drive.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ local_path, remote_path }) => {
      try {
        const r = await driveClient.upload(local_path, remote_path)
        if (!r.ok)
          return {
            isError: true,
            content: [{ type: 'text', text: `Upload failed: ${r.error}` }],
          }
        return {
          content: [
            {
              type: 'text',
              text: `Uploaded \`${r.localPath}\` → \`${r.remotePath}\``,
            },
          ],
          structuredContent: { ...r },
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_share',
    {
      title: 'Share a Proton Drive path',
      description:
        'Invites a Proton user to collaborate on a remote path using the proton-drive CLI.',
      inputSchema: {
        remote_path: z
          .string()
          .describe('Remote Proton Drive path to share.'),
        user_email: z.email().describe('Email of the user to invite.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ remote_path, user_email }) => {
      try {
        const r = await driveClient.share(remote_path, user_email)
        if (!r.ok)
          return {
            isError: true,
            content: [{ type: 'text', text: `Share failed: ${r.error}` }],
          }
        return {
          content: [
            {
              type: 'text',
              text: `Invited \`${r.userEmail}\` to \`${r.remotePath}\`.`,
            },
          ],
          structuredContent: { ...r },
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err) }],
        }
      }
    },
  )

  server.registerTool(
    'proton_drive_move',
    {
      title: 'Move files on Proton Drive',
      description: 'Moves a remote path using the proton-drive CLI.',
      inputSchema: {
        from: z.string().describe('Current remote path'),
        to: z.string().describe('Destination remote path'),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ from, to }) => {
      const r = await driveClient.moveFiles(from, to)
      if (!r.ok)
        return {
          isError: true,
          content: [{ type: 'text', text: r.error ?? '' }],
        }
      return {
        content: [{ type: 'text', text: `Moved ${from} \u2192 ${to}` }],
      }
    },
  )

  server.registerTool(
    'proton_drive_copy',
    {
      title: 'Copy files on Proton Drive',
      description: 'Copies a remote path using the proton-drive CLI.',
      inputSchema: {
        from: z.string().describe('Source remote path'),
        to: z.string().describe('Destination remote path'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ from, to }) => {
      const r = await driveClient.copyFiles(from, to)
      if (!r.ok)
        return {
          isError: true,
          content: [{ type: 'text', text: r.error ?? '' }],
        }
      return {
        content: [{ type: 'text', text: `Copied ${from} \u2192 ${to}` }],
      }
    },
  )

  server.registerTool(
    'proton_drive_create_folder',
    {
      title: 'Create folder on Proton Drive',
      description: 'Creates a new folder using the proton-drive CLI.',
      inputSchema: {
        remote_path: z.string().describe('Remote path for the new folder'),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ remote_path }) => {
      const r = await driveClient.mkdir(remote_path)
      if (!r.ok)
        return {
          isError: true,
          content: [{ type: 'text', text: r.error ?? '' }],
        }
      return {
        content: [{ type: 'text', text: `Created folder: ${remote_path}` }],
      }
    },
  )

  server.registerTool(
    'proton_drive_remove',
    {
      title: 'Remove files from Proton Drive',
      description:
        'Permanently removes a remote path from Proton Drive. Destructive operation.',
      inputSchema: {
        remote_path: z.string().describe('Remote path to remove'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ remote_path }) => {
      const r = await driveClient.removeFiles(remote_path)
      if (!r.ok)
        return {
          isError: true,
          content: [{ type: 'text', text: r.error ?? '' }],
        }
      return { content: [{ type: 'text', text: `Removed: ${remote_path}` }] }
    },
  )
}