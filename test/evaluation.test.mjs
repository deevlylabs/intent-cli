import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePolicy } from "../src/intent/parser-policy.mjs";
import { evaluate } from "../src/core/evaluate.mjs";

const POLICY_SRC = readFileSync(join(import.meta.dirname, "fixtures/default.intent"), "utf-8");
const policySpec = parsePolicy(POLICY_SRC);

function makeAction(overrides) {
  return { kind: "ModifyFile", path: "app/auth/login.ts", fileDomain: "Identity", hunks: [], ...overrides };
}

describe("evaluation engine", () => {
  it("produces no violations when file domain matches task domain", () => {
    const actions = [makeAction({ fileDomain: "Identity" })];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });
    expect(result.violations).toHaveLength(0);
    expect(result.status).toBe("pass");
  });

  it("flags CrossDomainTouch when file domain differs from task domain", () => {
    const actions = [makeAction({ fileDomain: "Billing", path: "app/billing/x.ts" })];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });

    const cross = result.violations.find((v) => v.code === "CrossDomainTouch");
    expect(cross).toBeDefined();
    expect(cross.severity).toBe("error");
    expect(cross.confidence).toBe("high");
    expect(result.status).toBe("blocked");
  });

  it("flags UnknownDomainFile when fileDomain is null", () => {
    const actions = [makeAction({ fileDomain: null, path: "unknown/file.ts" })];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });

    const unknown = result.violations.find((v) => v.code === "UnknownDomainFile");
    expect(unknown).toBeDefined();
    expect(unknown.severity).toBe("error");
    expect(result.status).toBe("blocked");
  });

  it("bypasses CrossDomainTouch when tag matches", () => {
    const actions = [makeAction({ fileDomain: "Billing", path: "app/billing/x.ts" })];
    const task = { domain: "Identity", tags: ["intentional-cross-domain"], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });

    const cross = result.violations.find((v) => v.code === "CrossDomainTouch");
    expect(cross).toBeDefined();
    expect(cross.bypassed).toBeTruthy();
    expect(cross.bypassed.tag).toBe("intentional-cross-domain");
    expect(cross.severity).toBe("warn");
    expect(result.status).toBe("warn");
  });

  it("downgrades medium-confidence error to warn", () => {
    const mediumPolicy = parsePolicy(`intent 2.0
policy Test {
  violation TestViolation confidence medium {
    when action.kind == "ModifyFile" && file.domain != task.domain
    severity error
    message "Medium confidence cross domain"
  }
}`);
    const actions = [makeAction({ fileDomain: "Billing" })];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [mediumPolicy], actions, task });

    expect(result.violations[0].severity).toBe("warn");
    expect(result.status).not.toBe("blocked");
  });

  it("treats low-confidence as info", () => {
    const lowPolicy = parsePolicy(`intent 2.0
policy Test {
  violation TestViolation confidence low {
    when action.kind == "ModifyFile" && file.domain != task.domain
    severity error
    message "Low confidence"
  }
}`);
    const actions = [makeAction({ fileDomain: "Billing" })];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [lowPolicy], actions, task });

    expect(result.violations[0].severity).toBe("info");
  });

  it("warns when task scope is unknown and there are no violations", () => {
    const actions = [makeAction({ fileDomain: "Identity" })];
    const task = { domain: null, tags: [], source: "unknown" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });
    expect(result.status).toBe("warn");
  });

  it("sorts violations: severity, then file path, then rule name", () => {
    const actions = [
      makeAction({ fileDomain: null, path: "z/file.ts" }),
      makeAction({ fileDomain: "Billing", path: "a/file.ts" }),
    ];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });

    const codes = result.violations.map((v) => v.code);
    expect(codes[0]).toBe("CrossDomainTouch");
    expect(codes[1]).toBe("UnknownDomainFile");
  });

  it("interpolates message template variables", () => {
    const actions = [makeAction({ fileDomain: "Billing", path: "app/billing/x.ts" })];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });

    const cross = result.violations.find((v) => v.code === "CrossDomainTouch");
    expect(cross.message).toContain("Billing");
    expect(cross.message).toContain("Identity");
    expect(cross.message).toContain("app/billing/x.ts");
  });

  it("handles multiple actions correctly", () => {
    const actions = [
      makeAction({ fileDomain: "Identity", path: "app/auth/a.ts" }),
      makeAction({ fileDomain: "Identity", path: "app/auth/b.ts" }),
      makeAction({ fileDomain: "Billing", path: "app/billing/c.ts" }),
    ];
    const task = { domain: "Identity", tags: [], source: "pr_header" };
    const result = evaluate({ policySpecs: [policySpec], actions, task });

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].evidence.path).toBe("app/billing/c.ts");
  });
});
