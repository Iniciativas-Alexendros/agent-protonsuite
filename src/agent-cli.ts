#!/usr/bin/env node
/**
 * Proton Suite Agent — CLI entry point.
 *
 * Usage:
 *   protonsuite-agent [goal]         Run an agent goal (default: setup)
 *   protonsuite-agent --help         Show this help
 *   protonsuite-agent --version      Show version
 *   protonsuite-agent --list         List all available goals
 *
 * Exit codes:
 *   0 = success
 *   1 = runtime error
 *   2 = invalid arguments / configuration
 */
import { runAgent, parseGoal, describeGoal } from "./agent/index.js";
import { VERSION } from "./version.js";

const GOALS = [
  'discover', 'setup', 'check-imap', 'organize', 'monitor', 'alert',
  'pass-audit', 'suite-status', 'suite-manage',
  'drive-audit', 'drive-organize', 'drive-list', 'drive-download', 'drive-upload',
] as const;

function showHelp(): void {
  process.stdout.write(`Proton Suite Agent v${VERSION}

Usage:
  protonsuite-agent [goal]            Run an agent goal
  protonsuite-agent --help | -h       Show this help
  protonsuite-agent --version | -V    Show version
  protonsuite-agent --list | -l       List all available goals with descriptions

Goals:
${GOALS.map((g) => `  ${g.padEnd(20)} ${describeGoal(g)}`).join('\n')}

Exit codes:
  0  Success
  1  Runtime error — check stderr
  2  Invalid arguments or configuration

Environment:
  See .env.example or docs/ for configuration variables.
  LOG_LEVEL=error|warn|info|debug  (default: info)
`);
}

async function main(): Promise<void> {
  const arg = process.argv[2] ?? '';

  // Flags
  if (arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  }
  if (arg === '--version' || arg === '-V') {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }
  if (arg === '--list' || arg === '-l') {
    for (const g of GOALS) {
      process.stdout.write(`${g}\n  ${describeGoal(g)}\n\n`);
    }
    process.exit(0);
  }

  // Unknown flag
  if (arg.startsWith('--') || arg.startsWith('-')) {
    process.stderr.write(`[ERROR] Unknown flag: ${arg}\n`);
    showHelp();
    process.exit(2);
  }

  // Validate and run goal
  let goal: string;
  try {
    goal = parseGoal(arg || undefined);
  } catch (err) {
    process.stderr.write(`[ERROR] ${(err as Error).message}\n`);
    process.exit(2);
  }

  await runAgent(goal);
}

main().catch((err: unknown) => {
  process.stderr.write(`[FATAL] ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
