import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AlertEvent, AlertSink } from "./types.js";

export class FileAlertSink implements AlertSink {
  constructor(private readonly logDir: string) {}

  async emit(event: AlertEvent): Promise<void> {
    const date = event.timestamp.slice(0, 10);
    const path = `${this.logDir}/alerts-${date}.jsonl`;
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, JSON.stringify(event) + "\n", "utf8");
  }
}
