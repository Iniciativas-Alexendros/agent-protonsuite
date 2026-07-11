import { mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { AlertSystem } from '../alerts/index.js'
import { loadConfig, type Config } from '../config.js'
import { createLogger } from '../config.js'
import { parseGoal, buildGoalContext, describeGoal } from './goals.js'
import { buildOrganizationPlan, applyOrganizationPlan } from './organizer.js'
import { runSetup, runImapCheck } from './setup.js'
export async function runAgent(
  goalName: string,
  _env?: NodeJS.ProcessEnv,
): Promise<void> {
  const goal = parseGoal(goalName)
  const cfg = loadConfig()
  const log = createLogger(cfg.logLevel)
  const alerts = new AlertSystem(cfg.alerts, log)
  await alerts.init()

  const ctx = buildGoalContext(goal, cfg.agent)
  log.info('agent goal', {
    goal,
    dryRun: ctx.dryRun,
    description: describeGoal(goal),
  })
  alerts.audit('agent-start', 'agent/executor', { goal, dryRun: ctx.dryRun })

  switch (goal) {
    case 'discover': {
      const report = await runSetup(cfg, log)
      log.info('discover report', { report })
      break
    }
    case 'setup': {
      const report = await runSetup(cfg, log)
      if (report.imapOk && report.smtpOk) {
        log.info('setup complete', { folders: report.folders.length })
      } else {
        log.error('setup incomplete', {
          recommendations: report.recommendations,
        })
        process.exit(2)
      }
      break
    }
    case 'check-imap': {
      const report = await runImapCheck(cfg, log)
      log.info('check-imap report', {
        imapOk: report.imapOk,
        authOk: report.authOk,
        folders: report.folders.length,
      })
      if (!report.imapOk) {
        process.exit(2)
      }
      break
    }
    case 'organize':
    case 'monitor':
    case 'alert': {
      const plan = await buildOrganizationPlan(cfg, ctx, log, alerts)
      if (goal === 'monitor' || goal === 'alert') {
        log.info('monitor/alert plan', {
          newFolders: plan.newFolders,
          folderProposals: plan.folderProposals.length,
          labelProposals: plan.labelProposals.length,
          alerts: plan.alerts.length,
        })
        break
      }
      if (ctx.dryRun) {
        log.info('dry-run organization plan', plan)
        alerts.info(
          'organize',
          'Plan de organización generado en modo dry-run; no se aplicaron cambios.',
          'agent/executor',
          {
            newFolders: plan.newFolders,
            folderProposals: plan.folderProposals.length,
            labelProposals: plan.labelProposals.length,
          },
        )
      } else {
        await applyOrganizationPlan(cfg, plan, log)
        alerts.audit('organize-applied', 'agent/executor', {
          newFolders: plan.newFolders,
          folderProposals: plan.folderProposals.length,
          labelProposals: plan.labelProposals.length,
        })
      }
      break
    }
    case 'pass-audit': {
      if (!cfg.products.pass.enabled) {
        log.error('Proton Pass is not enabled. Set PROTON_PASS_ENABLED=true.')
        process.exit(2)
      }
      // Dynamic import to avoid loading pass module when not enabled
      const { PassClient } = await import('../pass.js')
      const passClient = new PassClient(
        { storeDir: cfg.products.pass.storeDir },
        log,
      )
      const report = await passClient.audit()
      log.info('pass-audit report', report)
      alerts.audit('pass-audit', 'agent/executor', report)
      break
    }
    case 'drive-audit':
    case 'drive-organize':
    case 'drive-list':
    case 'drive-download':
    case 'drive-upload': {
      if (!cfg.products.drive.enabled) {
        log.error('Drive is not configured. Set DRIVE_ENABLED=true.')
        process.exit(2)
      }
      const { DriveClient } = await import('../drive.js')
      const { DriveAuditor } = await import('../drive-audit.js')
      const driveCfg = cfg.products.drive
      const driveClient = new DriveClient(driveCfg, log)
      const auditor = new DriveAuditor(driveCfg.obsoleteExtensions, log)

      if (goal === 'drive-audit') {
        const inv = auditor.scanInventory(driveClient.stagingDir)
        const dups = auditor.findDuplicates(driveClient.stagingDir)
        const fmt = auditor.formatReport(driveClient.stagingDir)
        log.info('drive-audit report', {
          totalFiles: inv.totalFiles,
          totalBytes: inv.totalBytes,
          duplicates: dups.length,
          obsoleteFiles: fmt.obsoleteFiles.length,
        })
        alerts.audit('drive-audit', 'agent/executor', {
          totalFiles: inv.totalFiles,
          duplicates: dups.length,
          obsoleteFiles: fmt.obsoleteFiles.length,
        })
      } else if (goal === 'drive-organize') {
        const plan = auditor.buildOrganizePlan(driveClient.stagingDir)
        if (ctx.dryRun) {
          log.info('drive-organize plan (dry-run)', {
            suggestions: plan.suggestions.length,
          })
          alerts.info(
            'drive-organize',
            'Plan de organización Drive en dry-run',
            'agent/executor',
            {
              suggestions: plan.suggestions.length,
            },
          )
        } else {
          let moved = 0
          for (const s of plan.suggestions) {
            if (s.action === 'move') {
              const src = resolve(driveClient.stagingDir, s.from)
              const dst = resolve(driveClient.stagingDir, s.to)
              mkdirSync(dirname(dst), { recursive: true })
              renameSync(src, dst)
              moved++
            }
          }
          log.info('drive-organize applied', { moved })
          alerts.audit('drive-organize-applied', 'agent/executor', { moved })
        }
      } else if (goal === 'drive-list') {
        const r = await driveClient.listFiles('/my-files')
        if (!r.ok) {
          log.error('drive-list failed', { error: r.error })
          process.exit(2)
        }
        log.info('drive-list ok', { entries: r.files.length })
        alerts.audit('drive-list', 'agent/executor', {
          entries: r.files.length,
        })
      } else if (goal === 'drive-download') {
        const r = await driveClient.download('/my-files')
        if (!r.ok) {
          log.error('drive-download failed', { error: r.error })
          process.exit(2)
        }
        log.info('drive-download ok', { localPath: r.localPath })
        alerts.audit('drive-download', 'agent/executor', {
          localPath: r.localPath,
        })
      } else {
        const r = await driveClient.upload()
        if (!r.ok) {
          log.error('drive-upload failed', { error: r.error })
          process.exit(2)
        }
        log.info('drive-upload ok', { remotePath: r.remotePath })
        alerts.audit('drive-upload', 'agent/executor', {
          remotePath: r.remotePath,
        })
      }
      break
    }
    case 'suite-status': {
      log.info('suite status', {
        mail: cfg.products.mail.enabled ? 'enabled' : 'disabled',
        pass: cfg.products.pass.enabled ? 'enabled' : 'disabled',
        calendar: cfg.products.calendar.enabled ? 'enabled (stub)' : 'disabled',
        drive: cfg.products.drive.enabled
          ? 'enabled (proton-drive CLI)'
          : 'disabled',
      })
      break
    }
  }

  alerts.audit('agent-end', 'agent/executor', { goal })
}

export { loadConfig }
export type { Config }
