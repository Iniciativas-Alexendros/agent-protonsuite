import { mkdir } from "node:fs/promises";
import type { Config } from "../config.js";
import { FileAlertSink } from "./file.js";
import { WebhookAlertSink } from "./webhook.js";
import { SEVERITY_RANK, type AlertEvent, type AlertSeverity } from "./types.js";
import { classifyEmail, detectThreats } from "./rules.js";

export type { AlertEvent, AlertSeverity } from "./types.js";
export { classifyEmail, detectThreats, inferStateLabels } from "./rules.js";

export type Logger = {
  error: (msg: string, extra?: unknown) => void;
  warn: (msg: string, extra?: unknown) => void;
  info: (msg: string, extra?: unknown) => void;
  debug: (msg: string, extra?: unknown) => void;
};

export class AlertSystem {
  private readonly fileSink: FileAlertSink;
  private readonly webhookSink?: WebhookAlertSink;
  private readonly minRank: number;

  constructor(
    private readonly cfg: Config["alerts"],
    private readonly log: Logger,
  ) {
    this.fileSink = new FileAlertSink(cfg.logDir);
    this.minRank = SEVERITY_RANK[cfg.minSeverity];
    if (cfg.webhookUrl) {
      this.webhookSink = new WebhookAlertSink(cfg.webhookUrl);
    }
  }

  async init(): Promise<void> {
    await mkdir(this.cfg.logDir, { recursive: true });
  }

  emit(severity: AlertSeverity, category: string, message: string, source: string, context?: Record<string, unknown>): void {
    if (!this.cfg.enabled) return;
    const event: AlertEvent = {
      severity,
      category,
      message,
      timestamp: new Date().toISOString(),
      source,
      context,
    };

    // Always log to stderr if the base logger level permits (info and above).
    this.log.info("alert", event);

    // File and webhook only for configured minimum severity.
    if (SEVERITY_RANK[severity] < this.minRank) return;

    void this.fileSink.emit(event).catch((err) => {
      this.log.error("failed to write alert to file", { error: (err as Error).message });
    });

    if (this.webhookSink) {
      void this.webhookSink.emit(event).catch((err) => {
        this.log.error("failed to send alert webhook", { error: (err as Error).message });
      });
    }
  }

  info(category: string, message: string, source: string, context?: Record<string, unknown>): void {
    this.emit("info", category, message, source, context);
  }

  warning(category: string, message: string, source: string, context?: Record<string, unknown>): void {
    this.emit("warning", category, message, source, context);
  }

  alert(category: string, message: string, source: string, context?: Record<string, unknown>): void {
    this.emit("alert", category, message, source, context);
  }

  critical(category: string, message: string, source: string, context?: Record<string, unknown>): void {
    this.emit("critical", category, message, source, context);
  }

  audit(action: string, source: string, context?: Record<string, unknown>): void {
    const event: AlertEvent = {
      severity: "info",
      category: "audit",
      message: action,
      timestamp: new Date().toISOString(),
      source,
      context,
    };
    void this.fileSink.emit(event).catch(() => { /* noop */ });
  }
}
