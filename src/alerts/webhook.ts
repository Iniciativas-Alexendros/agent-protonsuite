import type { AlertEvent, AlertSink } from "./types.js";

export class WebhookAlertSink implements AlertSink {
  constructor(private readonly url: string) {}

  async emit(event: AlertEvent): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      throw new Error(`webhook ${res.status} ${res.statusText}`);
    }
  }
}
