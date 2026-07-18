import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../src/config.js";
import { buildHttpApp } from "../src/http.js";

const silent = {
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
};

function cfg(overrides: Partial<Config["transport"]> = {}): Config {
  return {
    products: {
      mail: {
        enabled: true,
        bridge: {
          user: "x@y.com",
          pass: "p",
          host: "127.0.0.1",
          imapPort: 1143,
          smtpPort: 1025,
          from: "x@y.com",
          tlsInsecure: true,
          smtpSecurity: "starttls",
        },
      },
      pass: { enabled: false, storeDir: "/tmp" },
      calendar: { enabled: false },
      drive: { enabled: false },
    },
    transport: {
      kind: "http",
      httpHost: "127.0.0.1",
      httpPort: 8787,
      authToken: "expected-token",
      allowedOrigins: [],
      ...overrides,
    },
    alerts: {
      enabled: false,
      logDir: "logs",
      minSeverity: "warning",
    },
    agent: {
      dryRun: true,
      maxInspectEmails: 10,
      minConfidence: 0.6,
    },
    logLevel: "error",
  };
}

const miniServer = (): McpServer =>
  new McpServer({ name: "t", version: "1.0.0" }, { instructions: "test" });

describe("HTTP transport · auth and session lifecycle", () => {
  beforeEach(() => {
    silent.debug.mockReset();
    silent.info.mockReset();
    silent.error.mockReset();
  });

  it("GET /healthz returns 200 without auth", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /mcp without bearer returns 401", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).post("/mcp").send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("POST /mcp with wrong bearer returns 401", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer wrong-token")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res.status).toBe(401);
  });

  it("POST /mcp with disallowed Origin returns 403", async () => {
    const app = buildHttpApp({
      buildServer: miniServer,
      cfg: cfg({ allowedOrigins: ["https://agent.example"] }),
      log: silent,
    });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Origin", "https://evil.com")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("origin_not_allowed");
  });

  it("POST /mcp with valid bearer but no session id and non-initialize body returns 400", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe(-32000);
  });

  it("POST /mcp initialize returns MCP session id header and OK body", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      });
    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toMatch(/[0-9a-f-]{36}/);
  });

  it("timing-safe auth: short wrong token does not leak via status", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const short = await request(app).post("/mcp").set("Authorization", "Bearer x").send({});
    const wrong = await request(app).post("/mcp").set("Authorization", "Bearer yy-very-different-length").send({});
    expect(short.status).toBe(401);
    expect(wrong.status).toBe(401);
  });

  it("ratelimit middleware is wired (sends a RateLimit* header on /mcp)", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).post("/mcp").set("Authorization", "Bearer expected-token").send({ jsonrpc: "2.0", id: 1, method: "x" });
    const hasRateLimitHeader = Object.keys(res.headers).some((k) => k.toLowerCase().startsWith("ratelimit"));
    expect(hasRateLimitHeader).toBe(true);
  });
});

describe("CORS preflight", () => {
  it("OPTIONS /mcp con origin permitido devuelve 204 con CORS headers", async () => {
    const app = buildHttpApp({
      buildServer: miniServer,
      cfg: cfg({ allowedOrigins: ["https://app.example.com"] }),
      log: silent,
    });
    const res = await request(app)
      .options("/mcp")
      .set("Origin", "https://app.example.com")
      .set("Access-Control-Request-Method", "POST");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-max-age"]).toBe("600");
  });

  it("OPTIONS /mcp sin origin permitido igual devuelve 204 (preflight no pasa por auth)", async () => {
    const app = buildHttpApp({
      buildServer: miniServer,
      cfg: cfg({ allowedOrigins: ["https://trusted.com"] }),
      log: silent,
    });
    const res = await request(app).options("/mcp").set("Origin", "https://evil.com");
    // OPTIONS preflight siempre devuelve 204 aunque el origin no esté en allowlist
    expect(res.status).toBe(204);
    // Sin embargo, el header Access-Control-Allow-Origin solo se pone si está en allowlist
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("OPTIONS /mcp sin origin header devuelve 204", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).options("/mcp");
    expect(res.status).toBe(204);
  });

  it("POST /mcp con origin permitido incluye ACAO header", async () => {
    const app = buildHttpApp({
      buildServer: miniServer,
      cfg: cfg({ allowedOrigins: ["https://app.example.com"] }),
      log: silent,
    });
    const res = await request(app)
      .post("/mcp")
      .set("Origin", "https://app.example.com")
      .set("Authorization", "Bearer expected-token")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect(res.headers.vary).toBe("Origin");
  });
});

describe("Session lifecycle", () => {
  it("initialize crea sesión y devuelve session id", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      });
    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toBeDefined();
  });

  it("segundo request con session id existente no rechaza", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    // Inicializar sesión
    const initRes = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      });
    const sessionId = initRes.headers["mcp-session-id"];

    // Usar la sesión existente (mismo Accept header que el SDK espera)
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Mcp-Session-Id", sessionId)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(res.status).toBe(200);
  });

  it("request con session id inválido devuelve 400", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Mcp-Session-Id", "no-such-session")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe(-32000);
  });

  it("session id se pasa en minúsculas (mcp-session-id)", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const initRes = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      });
    const sessionId = initRes.headers["mcp-session-id"];

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("mcp-session-id", sessionId)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(res.status).toBe(200);
  });
});

describe("Auth edge cases", () => {
  it("POST /mcp sin Authorization header devuelve 401", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).post("/mcp").send({});
    expect(res.status).toBe(401);
  });

  it("POST /mcp sin authToken configurado (undefined) → bearer vacío → 401", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg({ authToken: undefined as never }), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer any-token")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    // authToken undefined → expectedToken = '' → compareTokens(any, '') falla → 401
    expect(res.status).toBe(401);
  });

  it("malformed Authorization header (sin Bearer) devuelve 401", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).post("/mcp").set("Authorization", "Basic xyz").send({});
    expect(res.status).toBe(401);
  });

  it("authorization con formato valido pero token vacío devuelve 401", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app).post("/mcp").set("Authorization", "Bearer ").send({});
    expect(res.status).toBe(401);
  });
});

describe("Error handling", () => {
  it("POST /mcp con body inválido (no JSON) devuelve 500", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer expected-token")
      .set("Content-Type", "application/json")
      .send("{invalid json}");
    // El error de parseo JSON se propaga al catch del handler → 500
    expect([400, 500]).toContain(res.status);
  });

  it("GET /mcp sin sesión devuelve 400 con error JSON-RPC", async () => {
    const app = buildHttpApp({ buildServer: miniServer, cfg: cfg(), log: silent });
    const res = await request(app)
      .get("/mcp")
      .set("Authorization", "Bearer expected-token");
    // GET sin session id → no entry → 400
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe(-32000);
  });
});
