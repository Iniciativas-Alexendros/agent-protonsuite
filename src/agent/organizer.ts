import { ImapClient, type EmailSummary } from "../imap.js";
import { classifyEmail, detectThreats, type AlertSystem } from "../alerts/index.js";
import type { Config } from "../config.js";
import type { OrganizationPlan, GoalContext } from "./types.js";
import type { Logger } from "../alerts/index.js";

interface ClassifiedEmail {
  uid: number;
  summary: EmailSummary;
  classification: ReturnType<typeof classifyEmail>;
  threats: ReturnType<typeof detectThreats>;
}

export async function buildOrganizationPlan(
  cfg: Config,
  ctx: GoalContext,
  log: Logger,
  alerts: AlertSystem,
): Promise<OrganizationPlan> {
  const imap = new ImapClient(cfg.bridge, log);
  const plan: OrganizationPlan = {
    newFolders: [],
    folderProposals: [],
    labelProposals: [],
    alerts: [],
  };

  try {
    const existingFolders = new Set((await imap.listMailboxes()).map((f) => f.path));
    const { items: summaries } = await imap.listEmails("INBOX", ctx.maxInspectEmails, 0);
    const classified: ClassifiedEmail[] = [];

    for (const summary of summaries) {
      if (!summary.uid) continue;
      const full = await imap.getEmail("INBOX", summary.uid);
      if (!full) continue;
      const classification = classifyEmail({
        from: full.from,
        subject: full.subject,
        text: full.textBody,
        html: full.htmlBody,
      });
      const threats = detectThreats({
        from: full.from,
        subject: full.subject,
        text: full.textBody,
        html: full.htmlBody,
      });
      classified.push({ uid: summary.uid, summary, classification, threats });
    }

    // Group by category and propose folders.
    const byCategory = new Map<string, ClassifiedEmail[]>();
    for (const c of classified) {
      if (c.classification.confidence < ctx.minConfidence) continue;
      const list = byCategory.get(c.classification.category) ?? [];
      list.push(c);
      byCategory.set(c.classification.category, list);
    }

    for (const [category, emails] of byCategory) {
      if (emails.length === 0) continue;
      const sample = emails[0]!.classification;
      const folder = sample.suggestedFolder;
      if (!existingFolders.has(folder)) {
        plan.newFolders.push(folder);
      }
      plan.folderProposals.push({
        path: folder,
        reason: `${emails.length} correos clasificados como ${category} (${sample.reason})`,
        emails: emails.map((e) => e.uid),
      });

      for (const label of sample.suggestedLabels) {
        const existing = plan.labelProposals.find((l) => l.name === label);
        if (existing) {
          existing.emails.push(...emails.map((e) => e.uid));
        } else {
          plan.labelProposals.push({
            name: label,
            reason: `Etiqueta sugerida para ${category}`,
            emails: emails.map((e) => e.uid),
          });
        }
      }
    }

    // Security alerts from threat detection.
    for (const c of classified) {
      for (const threat of c.threats) {
        if (threat.confidence < ctx.minConfidence) continue;
        const severity = threat.severity;
        const message = `Amenaza ${threat.threat} detectada en UID ${c.uid}: ${threat.indicators.slice(0, 3).join(", ")}`;
        alerts.emit(severity, "threat", message, "agent/organizer", {
          uid: c.uid,
          category: c.classification.category,
          threat: threat.threat,
          indicators: threat.indicators,
        });
        plan.alerts.push({
          severity,
          category: "threat",
          message,
          uids: [c.uid],
        });
      }
    }

    alerts.info(
      "organize",
      `Análisis completado: ${classified.length} correos inspeccionados, ${plan.folderProposals.length} propuestas de carpeta, ${plan.alerts.length} alertas.`,
      "agent/organizer",
      { inspected: classified.length, proposals: plan.folderProposals.length, alerts: plan.alerts.length },
    );

    return plan;
  } finally {
    await imap.close().catch(() => { /* noop */ });
  }
}

export async function applyOrganizationPlan(
  cfg: Config,
  plan: OrganizationPlan,
  log: Logger,
): Promise<void> {
  const imap = new ImapClient(cfg.bridge, log);
  try {
    for (const folder of plan.newFolders) {
      await imap.createMailbox(folder);
      log.info("Created folder", { folder });
    }

    for (const proposal of plan.folderProposals) {
      for (const uid of proposal.emails) {
        await imap.moveEmail("INBOX", uid, proposal.path);
      }
      log.info("Moved emails", { folder: proposal.path, count: proposal.emails.length });
    }

    // Proton Bridge/labels: labels are implemented as mailboxes in IMAP.
    for (const proposal of plan.labelProposals) {
      if (!plan.newFolders.includes(proposal.name)) {
        await imap.createMailbox(proposal.name).catch(() => { /* may exist */ });
      }
      for (const uid of proposal.emails) {
        await imap.moveEmail("INBOX", uid, proposal.name).catch(() => { /* label already applied */ });
      }
      log.info("Applied label", { label: proposal.name, count: proposal.emails.length });
    }
  } finally {
    await imap.close().catch(() => { /* noop */ });
  }
}
