import { mkdir } from "node:fs/promises";
import type { Config } from "../config.js";
import { FileAlertSink } from "./file.js";
import { NtfyAlertSink } from "./ntfy.js";
import { SEVERITY_RANK, type AlertEvent, type AlertSeverity, type AlertSink } from "./types.js";
import { WebhookAlertSink } from "./webhook.js";

export type { AlertEvent, AlertSeverity } from "./types.js";
export { classifyEmail, detectThreats, inferStateLabels } from "./rules.js";

export interface Logger {
  error: (msg: string, extra?: unknown) => void;
  warn: (msg: string, extra?: unknown) => void;
  info: (msg: string, extra?: unknown) => void;
  debug: (msg: string, extra?: unknown) => void;
}

export class AlertSystem {
  private readonly fileSink: FileAlertSink;
  private readonly sinks: AlertSink[] = [];
  private readonly minRank: number;

  constructor(
    private readonly cfg: Config["alerts"],
    private readonly log: Logger,
  ) {
    this.fileSink = new FileAlertSink(cfg.logDir);
    this.sinks.push(this.fileSink);
    this.minRank = SEVERITY_RANK[cfg.minSeverity];
    if (cfg.webhookUrl) {
      this.sinks.push(new WebhookAlertSink(cfg.webhookUrl));
    }
    if (cfg.ntfy?.url && cfg.ntfy.topic) {
      this.sinks.push(
        new NtfyAlertSink(cfg.ntfy.url, cfg.ntfy.topic, cfg.ntfy.token),
      );
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

    for (const sink of this.sinks) {
      const result = sink.emit(event);
      if (result instanceof Promise) {
        void result.catch((err: unknown) => {
          this.log.error("alert sink failed", { error: String(err) });
        });
      }
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
    void this.fileSink.emit(event).catch(() => {
      /* audit trail — best effort */
    });
  }
}
