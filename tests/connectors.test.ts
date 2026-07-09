import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

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
    expect(parsed.mcpServers.protonsuite).toBeDefined();
    expect(parsed.mcpServers.protonsuite.command).toBe("npx");
    expect(parsed.mcpServers.protonsuite.args).toEqual([
      "-y",
      "@alexendros/protonsuite-agent",
      "protonsuite-mcp",
    ]);
    expect(parsed.mcpServers.protonsuite.env.MCP_TRANSPORT).toBe("stdio");
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
