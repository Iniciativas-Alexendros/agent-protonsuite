export type AlertSeverity = "info" | "warning" | "alert" | "critical";

export interface AlertEvent {
  severity: AlertSeverity;
  category: string;
  message: string;
  timestamp: string;
  source: string;
  // Sanitized identifiers: UIDs, mailbox paths, subject hashes, never full bodies.
  context?: Record<string, unknown>;
}

export interface AlertSink {
  emit(event: AlertEvent): Promise<void> | void;
}

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  alert: 2,
  critical: 3,
};
