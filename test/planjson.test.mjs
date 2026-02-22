import { describe, it, expect } from "vitest";
import { buildPlanJson } from "../src/core/planjson.mjs";

describe("plan JSON builder", () => {
  it("produces correct schema shape", () => {
    const plan = buildPlanJson({
      intentVersion: "2.0",
      status: "pass",
      task: { domain: "Identity", tags: [], source: "pr_header" },
      actions: [{ kind: "ModifyFile", path: "app/auth/login.ts" }],
      violations: [],
    });

    expect(plan).toHaveProperty("intent_version", "2.0");
    expect(plan).toHaveProperty("status", "pass");
    expect(plan).toHaveProperty("task");
    expect(plan).toHaveProperty("actions_summary");
    expect(plan).toHaveProperty("violations");
  });

  it("counts ModifyFile actions", () => {
    const plan = buildPlanJson({
      intentVersion: "2.0",
      status: "pass",
      task: { domain: "X", tags: [], source: "cli_override" },
      actions: [
        { kind: "ModifyFile", path: "a.ts" },
        { kind: "ModifyFile", path: "b.ts" },
      ],
      violations: [],
    });
    expect(plan.actions_summary.modify_files).toBe(2);
    expect(plan.actions_summary.import_cross_domain).toBe(0);
  });

  it("includes task metadata", () => {
    const plan = buildPlanJson({
      intentVersion: "2.0",
      status: "warn",
      task: { domain: "Messaging", tags: ["intentional-cross-domain"], source: "inferred" },
      actions: [],
      violations: [],
    });
    expect(plan.task.domain).toBe("Messaging");
    expect(plan.task.tags).toEqual(["intentional-cross-domain"]);
    expect(plan.task.source).toBe("inferred");
  });

  it("serializes violations with all required fields", () => {
    const plan = buildPlanJson({
      intentVersion: "2.0",
      status: "blocked",
      task: { domain: "X", tags: [], source: "pr_header" },
      actions: [],
      violations: [
        {
          code: "CrossDomainTouch",
          severity: "error",
          confidence: "high",
          evidence: { path: "a.ts", file_domain: "Y", task_domain: "X" },
          remediation: { actions: ["Split PR"], approved_interfaces: [] },
          bypassed: null,
        },
      ],
    });

    const v = plan.violations[0];
    expect(v).toHaveProperty("code", "CrossDomainTouch");
    expect(v).toHaveProperty("severity", "error");
    expect(v).toHaveProperty("confidence", "high");
    expect(v).toHaveProperty("evidence");
    expect(v).toHaveProperty("remediation");
    expect(v).toHaveProperty("bypassed", null);
  });

  it("serializes bypassed violations", () => {
    const plan = buildPlanJson({
      intentVersion: "2.0",
      status: "warn",
      task: { domain: "X", tags: ["intentional-cross-domain"], source: "pr_header" },
      actions: [],
      violations: [
        {
          code: "CrossDomainTouch",
          severity: "warn",
          confidence: "high",
          evidence: { path: "a.ts" },
          remediation: { actions: [], approved_interfaces: [] },
          bypassed: { tag: "intentional-cross-domain", approval_required: "tech-lead", approved: false },
        },
      ],
    });

    expect(plan.violations[0].bypassed).toEqual({
      tag: "intentional-cross-domain",
      approval_required: "tech-lead",
      approved: false,
    });
  });

  it("defaults null task domain", () => {
    const plan = buildPlanJson({
      intentVersion: "2.0",
      status: "warn",
      task: { tags: [], source: "unknown" },
      actions: [],
      violations: [],
    });
    expect(plan.task.domain).toBeNull();
  });

  it("produces deterministic JSON (no timestamps, no random IDs)", () => {
    const args = {
      intentVersion: "2.0",
      status: "pass",
      task: { domain: "X", tags: [], source: "pr_header" },
      actions: [{ kind: "ModifyFile", path: "a.ts" }],
      violations: [],
    };
    const json1 = JSON.stringify(buildPlanJson(args));
    const json2 = JSON.stringify(buildPlanJson(args));
    expect(json1).toBe(json2);
  });
});
