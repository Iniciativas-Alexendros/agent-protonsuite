import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertSystem, classifyEmail, detectThreats } from "../src/alerts/index.js";
import type { Config } from "../src/config.js";

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

describe("alert classification rules", () => {
  it("classifies a legal email", () => {
    const res = classifyEmail({
      from: "bufete@ejemplo.com",
      subject: "Contrato de confidencialidad",
      text: "Adjunto encontrará el contrato y la cláusula de NDA.",
    });
    expect(res.category).toBe("legal");
    expect(res.confidence).toBeGreaterThan(0.5);
    expect(res.suggestedFolder).toBe("Legal");
  });

  it("classifies an admin email", () => {
    const res = classifyEmail({
      from: "hacienda@example.com",
      subject: "Recordatorio declaración IVA",
      text: "Debe presentar el modelo 303 antes del día 20.",
    });
    expect(res.category).toBe("admin");
    expect(res.confidence).toBeGreaterThan(0.5);
  });

  it("classifies spam", () => {
    const res = classifyEmail({
      from: "offers@spam.com",
      subject: "Limited time offer! Act now only!",
      text: "Unsubscribe now to stop receiving these emails.",
    });
    expect(res.category).toBe("spam");
    expect(res.severity).toBe("warning");
  });

  it("detects phishing threats", () => {
    const threats = detectThreats({
      from: "bad@example.com",
      subject: "Verify your account",
      text: "Click here to verify your account: https://evil.proton.ru/login",
    });
    expect(threats.length).toBeGreaterThan(0);
    expect(threats.some((t) => t.threat === "phishing_link")).toBe(true);
  });
});

describe("AlertSystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs info to base logger", () => {
    const alerts = new AlertSystem(baseAlerts, log);
    alerts.info("test", "hello", "unit");
    expect(log.info).toHaveBeenCalled();
  });

  it("does not emit when disabled", () => {
    const alerts = new AlertSystem({ ...baseAlerts, enabled: false }, log);
    alerts.critical("test", "hello", "unit");
    expect(log.info).not.toHaveBeenCalled();
  });
});
