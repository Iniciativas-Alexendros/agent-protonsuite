import { describe, it, expect } from "vitest";
import { parseGoal, describeGoal, buildGoalContext } from "../src/agent/index.js";
import type { GoalContext } from "../src/agent/index.js";

describe("agent goals", () => {
  it("parses known goals", () => {
    expect(parseGoal("discover")).toBe("discover");
    expect(parseGoal("setup")).toBe("setup");
    expect(parseGoal("organize")).toBe("organize");
    expect(parseGoal("monitor")).toBe("monitor");
    expect(parseGoal("alert")).toBe("alert");
  });

  it("defaults to setup", () => {
    expect(parseGoal(undefined)).toBe("setup");
  });

  it("rejects unknown goals", () => {
    expect(() => parseGoal("delete")).toThrow(/Unknown agent goal/);
  });

  it("describes goals in Spanish", () => {
    expect(describeGoal("discover")).toContain("Descubre");
    expect(describeGoal("organize")).toContain("Analiza");
  });

  it("builds goal context from config", () => {
    const ctx = buildGoalContext("organize", { dryRun: true, maxInspectEmails: 42, minConfidence: 0.5 });
    const expected: GoalContext = { goal: "organize", dryRun: true, maxInspectEmails: 42, minConfidence: 0.5 };
    expect(ctx).toEqual(expected);
  });
});
