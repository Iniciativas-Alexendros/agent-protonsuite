import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PassClient } from "../../src/pass.js";

const GNUPGHOME = mkdtempSync(join(tmpdir(), "pass-e2e-gnupg-"));
const STORE_DIR = mkdtempSync(join(tmpdir(), "pass-e2e-store-"));
process.env.GNUPGHOME = GNUPGHOME;
process.env.PASSWORD_STORE_DIR = STORE_DIR;
const GPG_ID = "pass-e2e@test.local";

const silentLog = { error() {}, warn() {}, info() {}, debug() {} };

function run(cmd: string, args: string[], extraEnv: Record<string, string> = {}) {
  return execFileSync(cmd, args, { env: { ...process.env, GNUPGHOME, PASSWORD_STORE_DIR: STORE_DIR, ...extraEnv }, encoding: "utf8" });
}

let client: PassClient;

beforeAll(() => {
  run("gpg", ["--batch", "--passphrase", "", "--quick-gen-key", GPG_ID, "default", "default", "0"]);
  run("pass", ["init", GPG_ID]);
  client = new PassClient({ storeDir: STORE_DIR }, silentLog);
});

afterAll(() => {
  rmSync(GNUPGHOME, { recursive: true, force: true });
  rmSync(STORE_DIR, { recursive: true, force: true });
  try { execFileSync("gpgconf", ["--kill", "gpg-agent"], { env: { ...process.env, GNUPGHOME } }); } catch { /* noop */ }
});

describe("Pass E2E · GPG real", () => {
  it("generate creates an entry and returns metadata", async () => {
    const result = await client.generate("test/service", 20);
    expect(result.path).toBe("test/service");
    expect(result.length).toBe(20);
  });

  it("list returns the generated entry", async () => {
    const entries = await client.list();
    expect(entries).toContain("test/service");
  });

  it("get returns the plaintext value", async () => {
    const value = await client.get("test/service");
    expect(value).toHaveLength(20);
  });

  it("health reports ok with 1 entry", async () => {
    const h = await client.health();
    expect(h.ok).toBe(true);
    expect(h.entries).toBeGreaterThanOrEqual(1);
  });

  it("audit detects weak passwords (< 12 chars)", async () => {
    await client.generate("test/weak", 8);
    const report = await client.audit();
    expect(report.storeOk).toBe(true);
    expect(report.weakPasswords).toContain("test/weak");
  });

  it("get with nonexistent path throws PassError", async () => {
    await expect(client.get("nonexistent/entry")).rejects.toThrowError(/Entry not found/);
  });

  it("get with unsafe path throws PassError", async () => {
    await expect(client.get("path/with spaces")).rejects.toThrowError(/Invalid entry path/);
  });

  it("generate with unsafe path throws PassError", async () => {
    await expect(client.generate("bad/path/../escape", 16)).rejects.toThrowError(/Invalid entry path/);
  });
});
