#!/usr/bin/env node
// Validate .github/renovate.json (JSON canónico). Acepta .json5 si se pasa explícito.
import { readFileSync } from "node:fs";

const file = process.argv[2] || ".github/renovate.json";
const src = readFileSync(file, "utf8");

try {
  let cfg;
  if (file.endsWith(".json5")) {
    const { default: json5 } = await import("json5");
    cfg = json5.parse(src);
  } else {
    cfg = JSON.parse(src);
  }
  const keys = Object.keys(cfg).length;
  const rules = cfg.packageRules?.length ?? 0;
  console.log(
    `VALID: ${file} (${src.split("\n").length} lines, ${keys} top-level keys, ${rules} packageRules)`,
  );
} catch (e) {
  console.error(`INVALID ${file}: ${e.message}`);
  process.exit(1);
}
