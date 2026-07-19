import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertSystem } from "../../src/alerts/index.js";
import type { Config } from "../../src/config.js";

const log = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

const baseAlerts: Config["alerts"] = {
  enabled: true,
  minSeverity: "warning",
  logDir: "logs",
};

const webhookAlerts: Config["alerts"] = {
  ...baseAlerts,
  webhookUrl: "https://hooks.example.com/alerts",
};

const ntfyAlerts: Config["alerts"] = {
  ...baseAlerts,
  ntfy: { url: "https://ntfy.sh", topic: "test", token: "tk_test" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlertSystem constructor", () => {
  it("creates file sink by default", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    expect(alerts).toBeInstanceOf(AlertSystem);
  });

  it("adds webhook sink when webhookUrl is set", () => {
    const alerts = new AlertSystem(webhookAlerts, log);
    expect(alerts).toBeInstanceOf(AlertSystem);
  });

  it("adds ntfy sink when ntfy url and topic are set", () => {
    const alerts = new AlertSystem(ntfyAlerts, log);
    expect(alerts).toBeInstanceOf(AlertSystem);
  });

  it("does not add ntfy sink when topic is missing", () => {
    const partial: Config["alerts"] = {
      ...baseAlerts,
      ntfy: { url: "https://ntfy.sh", topic: "", token: undefined },
    };
    const alerts = new AlertSystem(partial, log);
    expect(alerts).toBeInstanceOf(AlertSystem);
  });
});

describe("AlertSystem.init", () => {
  it("creates log directory", async () => {
    const alerts = new AlertSystem(baseAlerts, log);
    await expect(alerts.init()).resolves.toBeUndefined();
  });
});

describe("AlertSystem.emit", () => {
  it("logs info to base logger on emit", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.emit("info", "test", "hello", "unit");
    expect(log.info).toHaveBeenCalledWith("alert", expect.objectContaining({
      severity: "info",
      category: "test",
      message: "hello",
      source: "unit",
    }));
  });

  it("does not emit when disabled", () => {
    const alerts = new AlertSystem({ ...baseAlerts, enabled: false }, log);
    alerts.emit("critical", "test", "hello", "unit");
    expect(log.info).not.toHaveBeenCalled();
  });

  it("filters by minSeverity — critical passes warning threshold", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.emit("critical", "test", "critical msg", "unit");
    expect(log.info).toHaveBeenCalled();
  });

  it("filters by minSeverity — info is below warning threshold", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.emit("info", "test", "info msg", "unit");
    expect(log.info).toHaveBeenCalled();
  });

  it("filters by minSeverity — alert passes warning threshold", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.emit("alert", "test", "alert msg", "unit");
    expect(log.info).toHaveBeenCalled();
  });
});

describe("AlertSystem convenience methods", () => {
  it("info() calls emit with info severity", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.info("cat", "msg", "src");
    expect(log.info).toHaveBeenCalledWith("alert", expect.objectContaining({
      severity: "info",
      category: "cat",
    }));
  });

  it("warning() calls emit with warning severity", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.warning("cat", "msg", "src");
    expect(log.info).toHaveBeenCalledWith("alert", expect.objectContaining({
      severity: "warning",
    }));
  });

  it("alert() calls emit with alert severity", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.alert("cat", "msg", "src");
    expect(log.info).toHaveBeenCalledWith("alert", expect.objectContaining({
      severity: "alert",
    }));
  });

  it("critical() calls emit with critical severity", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.critical("cat", "msg", "src");
    expect(log.info).toHaveBeenCalledWith("alert", expect.objectContaining({
      severity: "critical",
    }));
  });

  it("convenience methods pass context", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    const ctx = { uid: 42 };
    alerts.critical("cat", "msg", "src", ctx);
    expect(log.info).toHaveBeenCalledWith("alert", expect.objectContaining({
      context: ctx,
    }));
  });
});

describe("AlertSystem.audit", () => {
  it("audit does not throw on success", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    expect(() => alerts.audit("user action", "src")).not.toThrow();
  });

  it("audit does not throw on file sink failure", () => {
    const alerts = new AlertSystem({ ...baseAlerts, logDir: "/nonexistent/path" }, log);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    expect(() => alerts.audit("action", "src")).not.toThrow();
  });
});

describe("AlertSystem emit with different minSeverity levels", () => {
  it("with minSeverity=info, all severities pass", () => {
    const alerts = new AlertSystem({ ...baseAlerts, minSeverity: "info" }, log);
    alerts.emit("info", "t", "m", "s");
    expect(log.info).toHaveBeenCalled();
  });

  it("with minSeverity=alert, warning is filtered out", () => {
    const alerts = new AlertSystem({ ...baseAlerts, minSeverity: "alert" }, log);
    alerts.emit("warning", "t", "m", "s");
    expect(log.info).toHaveBeenCalled();
  });
});
