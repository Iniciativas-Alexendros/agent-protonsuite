import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function readText(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("connectors · stdio-npx.json", () => {
  it("is valid JSON and contains a generic mcpServers block", () => {
    const raw = readText("connectors/stdio-npx.json");
    const parsed = JSON.parse(raw);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.protonmail).toBeDefined();
    expect(parsed.mcpServers.protonmail.command).toBe("npx");
    expect(parsed.mcpServers.protonmail.args).toEqual([
      "-y",
      "@alexendros/protonmail-agent",
      "protonmail-mcp",
    ]);
    expect(parsed.mcpServers.protonmail.env.MCP_TRANSPORT).toBe("stdio");
  });
});

describe("connectors · stdio-wrapper.sh.example", () => {
  it("uses exec to replace the shell", () => {
    const raw = readText("connectors/stdio-wrapper.sh.example");
    expect(raw).toMatch(/^exec /m);
  });

  it("does not print anything to stdout before exec", () => {
    const raw = readText("connectors/stdio-wrapper.sh.example");
    const lines = raw.split("\n");
    const echoLines = lines.filter((l) => l.startsWith("echo"));
    for (const line of echoLines) {
      expect(line).toMatch(/>&2/);
    }
  });

  it("does not hardcode a real bridge password", () => {
    const raw = readText("connectors/stdio-wrapper.sh.example");
    const nonCommentLines = raw
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(nonCommentLines).not.toMatch(/PROTON_BRIDGE_PASS\s*=\s*"[^"]+"/);
  });
});

describe("connectors · http-curl.sh.example", () => {
  it("mentions Mcp-Session-Id and Authorization header", () => {
    const raw = readText("connectors/http-curl.sh.example");
    expect(raw).toMatch(/Mcp-Session-Id/);
    expect(raw).toMatch(/Authorization: Bearer/);
  });
});
