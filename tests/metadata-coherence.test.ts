/**
 * Gate vivo de coherencia de metadatos entre los tres manifiestos publicables:
 *  - package.json (npm)
 *  - server.json (MCP registry, campo raíz + packages[0])
 *  - plugins/.../plugin.json (plugin de Claude Code)
 *
 * Si alguien desincroniza una versión o deja una env var del plugin huérfana
 * (sin correspondencia en server.json), este test falla. Las env vars secret
 * de server.json se permiten EXPUESTAS en el plugin (documentadas), pero toda
 * var REQUIRED no-secret de server.json DEBE estar presente en el userConfig
 * del plugin para que el instalador sepa qué necesita.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, rel), "utf8")) as Record<
    string,
    unknown
  >;
}

const pkg = readJson("package.json");
const server = readJson("server.json");
const plugin = readJson("plugins/protonmail-mcp/.claude-plugin/plugin.json");

interface ServerEnvVar {
  name: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

const serverPackages = server.packages as Array<Record<string, unknown>>;
const serverPkg0 = serverPackages[0]!;
const serverEnv = serverPkg0.environmentVariables as ServerEnvVar[];
const userConfig = plugin.userConfig as Record<
  string,
  { required?: boolean; sensitive?: boolean }
>;

describe("metadata coherence · version", () => {
  it("package.json, server.json (root + packages[0]) and plugin.json share the same version", () => {
    const pkgVersion = pkg.version as string;
    expect(server.version).toBe(pkgVersion);
    expect(serverPkg0.version).toBe(pkgVersion);
    expect(plugin.version).toBe(pkgVersion);
  });
});

describe("metadata coherence · env vars", () => {
  const serverNames = new Set(serverEnv.map((v) => v.name));

  it("every plugin userConfig var exists in server.json environmentVariables", () => {
    for (const name of Object.keys(userConfig)) {
      expect(
        serverNames,
        `plugin var ${name} missing from server.json`,
      ).toContain(name);
    }
  });

  it("no REQUIRED non-secret server var is absent from the plugin userConfig", () => {
    const requiredNonSecret = serverEnv
      .filter((v) => v.isRequired && !v.isSecret)
      .map((v) => v.name);
    for (const name of requiredNonSecret) {
      expect(
        Object.keys(userConfig),
        `required non-secret server var ${name} missing from plugin userConfig`,
      ).toContain(name);
    }
  });

  it("PROTON_BRIDGE_PASS is present and flagged sensitive in the plugin (secret, documented)", () => {
    expect(userConfig.PROTON_BRIDGE_PASS).toBeDefined();
    expect(userConfig.PROTON_BRIDGE_PASS?.sensitive).toBe(true);
    expect(userConfig.PROTON_BRIDGE_PASS?.required).toBe(true);
  });

  it("MCP_TRANSPORT is intentionally NOT exposed (plugin is always stdio)", () => {
    // The plugin's .protonmail-mcp_claude_mcp.json hardcodes MCP_TRANSPORT=stdio,
    // so surfacing it as a user-tunable would only mislead. Documented omission.
    expect(Object.keys(userConfig)).not.toContain("MCP_TRANSPORT");
  });
});
