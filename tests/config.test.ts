import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig · Zod env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("PROTON_") || k.startsWith("MCP_") || k === "LOG_LEVEL") delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws with clear error when PROTON_BRIDGE_USER is missing", () => {
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    expect(() => loadConfig()).toThrow(/PROTON_BRIDGE_USER/);
  });

  it("throws when PROTON_MAIL_FROM is not a valid email", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "not-an-email";
    expect(() => loadConfig()).toThrow();
  });

  it("defaults PROTON_MAIL_FROM to PROTON_BRIDGE_USER when unset", () => {
    process.env.PROTON_BRIDGE_USER = "alice@proton.me";
    process.env.PROTON_BRIDGE_PASS = "x";
    const cfg = loadConfig();
    expect(cfg.products.mail.bridge.from).toBe("alice@proton.me");
  });

  it("parses tlsInsecure=false correctly", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    process.env.PROTON_BRIDGE_TLS_INSECURE = "false";
    const cfg = loadConfig();
    expect(cfg.products.mail.bridge.tlsInsecure).toBe(false);
  });

  it("parses MCP_ALLOWED_ORIGINS CSV into array", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    process.env.MCP_ALLOWED_ORIGINS = "https://agent.example, https://dashboard.example";
    const cfg = loadConfig();
    expect(cfg.transport.allowedOrigins).toEqual([
      "https://agent.example",
      "https://dashboard.example",
    ]);
  });

  it("defaults to stdio transport when MCP_TRANSPORT unset", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    const cfg = loadConfig();
    expect(cfg.transport.kind).toBe("stdio");
  });

  it("defaults smtpSecurity to starttls (Bridge) and honors an override", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    expect(loadConfig().products.mail.bridge.smtpSecurity).toBe("starttls");
    process.env.PROTON_BRIDGE_SMTP_SECURITY = "implicit";
    expect(loadConfig().products.mail.bridge.smtpSecurity).toBe("implicit");
  });

  it("reads custom bridge host and ports from env", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "x";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    process.env.PROTON_BRIDGE_HOST = "bridge";
    process.env.PROTON_BRIDGE_IMAP_PORT = "1143";
    process.env.PROTON_BRIDGE_SMTP_PORT = "1025";
    const cfg = loadConfig();
    expect(cfg.products.mail.bridge.host).toBe("bridge");
    expect(cfg.products.mail.bridge.imapPort).toBe(1143);
    expect(cfg.products.mail.bridge.smtpPort).toBe(1025);
  });

  it("allows PROTON_BRIDGE_PASS_PATH without PROTON_BRIDGE_PASS", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    process.env.PROTON_BRIDGE_PASS_PATH = "proton/bridge/password";
    const cfg = loadConfig();
    expect(cfg.products.mail.bridge.pass).toBe("");
    expect(cfg.products.mail.bridge.passPath).toBe("proton/bridge/password");
  });

  it("allows both PROTON_BRIDGE_PASS and PROTON_BRIDGE_PASS_PATH", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    process.env.PROTON_BRIDGE_PASS = "legacy-password";
    process.env.PROTON_BRIDGE_PASS_PATH = "proton/bridge/password";
    const cfg = loadConfig();
    expect(cfg.products.mail.bridge.pass).toBe("legacy-password");
    expect(cfg.products.mail.bridge.passPath).toBe("proton/bridge/password");
  });

  it("throws when neither PROTON_BRIDGE_PASS nor PROTON_BRIDGE_PASS_PATH is set", () => {
    process.env.PROTON_BRIDGE_USER = "a@b.com";
    process.env.PROTON_MAIL_FROM = "a@b.com";
    expect(() => loadConfig()).toThrow(/PROTON_BRIDGE_PASS or PROTON_BRIDGE_PASS_PATH/);
  });
});
