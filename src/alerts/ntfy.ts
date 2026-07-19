import type { AlertEvent, AlertSink } from "./types.js";

export class NtfyAlertSink implements AlertSink {
  constructor(
    private readonly url: string,
    private readonly topic: string,
    private readonly token?: string,
  ) {}

  async emit(event: AlertEvent): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": "text/plain" };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const body = [
      `[${event.severity.toUpperCase()}] ${event.category}`,
      event.message,
      `Source: ${event.source}`,
      event.context ? `Context: ${JSON.stringify(event.context)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(`${this.url}/${this.topic}`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      throw new Error(`ntfy ${res.status} ${res.statusText}`);
    }
  }
}
