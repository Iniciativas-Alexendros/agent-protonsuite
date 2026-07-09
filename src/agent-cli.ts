#!/usr/bin/env node
// protonmail-agent → protonsuite-agent (rebrand v0.6.0)
import { runAgent } from "./agent/index.js";

async function main(): Promise<void> {
  const goal = process.argv[2] ?? "setup";
  await runAgent(goal);
}

main().catch((err: unknown) => {
  process.stderr.write(`[FATAL] ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
