import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { PassClient } from "../src/pass.js";
import type { PassLogger } from "../src/pass.js";

const silentLog: PassLogger = { error() {}, warn() {}, info() {}, debug() {} };

function mockExecPass(responses: Map<string, string>) {
  return async (
    args: string[],
    _opts: { env: NodeJS.ProcessEnv; input?: string },
  ): Promise<string> => {
    const key = args.join(" ");
    const response = responses.get(key);
    if (response !== undefined) return response;
    throw new Error(`pass exited with code 1`);
  };
}

/**
 * Crea un directorio temporal con ficheros .gpg para simular el password-store.
 * list() lee del filesystem directamente (no usa pass CLI), así que los tests
 * necesitan directorios reales.
 */
function createStore(entries: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "pass-test-"));
  for (const path of Object.keys(entries)) {
    const fullPath = join(dir, path + ".gpg");
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, "");
  }
  return dir;
}

describe("PassClient audit heuristic", () => {
  let storeDir: string;

  afterEach(() => {
    if (storeDir) rmSync(storeDir, { recursive: true, force: true });
  });

  it("marks password with length < 12 as weak regardless of charset diversity", async () => {
    storeDir = createStore({ "test/weak": "" });
    const responses = new Map([
      ["show test/weak", "aB3dEfGh"], // 8 chars, upper+lower+digit → typeCount=3
    ]);
    const client = new PassClient(
      { storeDir },
      silentLog,
      mockExecPass(responses),
    );
    const result = await client.audit();
    expect(result.weakPasswords).toContain("test/weak");
  });

  it("marks password with low charset diversity as weak even if length >= 12", async () => {
    storeDir = createStore({ "test/lowdiv": "" });
    const responses = new Map([
      ["show test/lowdiv", "abcabcabcabc"], // 12 chars, solo lower → typeCount=1
    ]);
    const client = new PassClient(
      { storeDir },
      silentLog,
      mockExecPass(responses),
    );
    const result = await client.audit();
    expect(result.weakPasswords).toContain("test/lowdiv");
  });

  it("does NOT mark password with length >= 12 AND typeCount >= 2 as weak", async () => {
    storeDir = createStore({ "test/strong": "" });
    const responses = new Map([
      ["show test/strong", "aB3dEfGhIjKl"], // 12 chars, upper+lower+digit → typeCount=3
    ]);
    const client = new PassClient(
      { storeDir },
      silentLog,
      mockExecPass(responses),
    );
    const result = await client.audit();
    expect(result.weakPasswords).not.toContain("test/strong");
  });

  it("detects duplicate passwords", async () => {
    storeDir = createStore({ "test/one": "", "test/two": "" });
    const responses = new Map([
      ["show test/one", "SamePassword123!"],
      ["show test/two", "SamePassword123!"],
    ]);
    const client = new PassClient(
      { storeDir },
      silentLog,
      mockExecPass(responses),
    );
    const result = await client.audit();
    expect(result.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(result.duplicates[0]).toContain("test/two");
    expect(result.duplicates[0]).toContain("duplicado de test/one");
  });

  it("skips entries that fail to decrypt", async () => {
    storeDir = createStore({ "test/good": "", "test/broken": "" });
    const responses = new Map([
      ["show test/good", "StrongP4ssword!"],
    ]);
    const client = new PassClient(
      { storeDir },
      silentLog,
      mockExecPass(responses),
    );
    const result = await client.audit();
    expect(result.totalEntries).toBe(2);
    expect(result.weakPasswords).not.toContain("test/broken");
  });
});

describe("PassClient insert", () => {
  it("insert uses --force flag to overwrite existing entries", async () => {
    const calls: Array<{ args: string[]; input?: string }> = [];
    const mockExec = async (
      args: string[],
      opts: { env: NodeJS.ProcessEnv; input?: string },
    ) => {
      calls.push({ args, input: opts.input });
      return "";
    };
    const client = new PassClient(
      { storeDir: "/tmp/mock-store" },
      silentLog,
      mockExec,
    );
    await client.insert("test/entry", "mysecret");
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual([
      "insert",
      "--multiline",
      "--force",
      "test/entry",
    ]);
    expect(calls[0].input).toBe("mysecret");
  });
});
