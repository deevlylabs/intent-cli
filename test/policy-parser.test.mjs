import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePolicy } from "../src/intent/parser-policy.mjs";

const FIXTURE = readFileSync(join(import.meta.dirname, "fixtures/default.intent"), "utf-8");

describe("policy parser", () => {
  it("parses the fixture policy file", () => {
    const spec = parsePolicy(FIXTURE, "test/fixtures/default.intent");
    expect(spec.kind).toBe("PolicySpec");
    expect(spec.intentVersion).toBe("2.0");
    expect(spec.policies).toHaveLength(1);
  });

  it("extracts policy name", () => {
    const spec = parsePolicy(FIXTURE);
    expect(spec.policies[0].name).toBe("Default");
  });

  it("extracts all violations", () => {
    const spec = parsePolicy(FIXTURE);
    const violations = spec.policies[0].violations;
    expect(violations).toHaveLength(3);
    expect(violations.map((v) => v.code)).toEqual([
      "CrossDomainTouch",
      "UnknownDomainFile",
      "CrossDomainImport",
    ]);
  });

  it("parses confidence levels", () => {
    const spec = parsePolicy(FIXTURE);
    const violations = spec.policies[0].violations;
    expect(violations[0].confidence).toBe("high");
    expect(violations[2].confidence).toBe("medium");
  });

  it("parses severity levels", () => {
    const spec = parsePolicy(FIXTURE);
    const violations = spec.policies[0].violations;
    expect(violations[0].severity).toBe("error");
    expect(violations[2].severity).toBe("warn");
  });

  it("parses except_when with requires_approval", () => {
    const spec = parsePolicy(FIXTURE);
    const cross = spec.policies[0].violations[0];
    expect(cross.exceptWhenTagged).toBe("intentional-cross-domain");
    expect(cross.requiresApproval).toBe("tech-lead");
  });

  it("parses standalone requires_approval", () => {
    const spec = parsePolicy(FIXTURE);
    const importV = spec.policies[0].violations[2];
    expect(importV.requiresApproval).toBe("staff-engineer");
    expect(importV.exceptWhenTagged).toBeNull();
  });

  it("parses suggest", () => {
    const spec = parsePolicy(FIXTURE);
    const v = spec.policies[0].violations[0];
    expect(v.suggest).toContain("Split into separate PR");
  });

  it("parses message with interpolation placeholders", () => {
    const spec = parsePolicy(FIXTURE);
    const v = spec.policies[0].violations[0];
    expect(v.message).toContain("{file.domain}");
    expect(v.message).toContain("{task.domain}");
  });

  it("parses when predicate as AST", () => {
    const spec = parsePolicy(FIXTURE);
    const v = spec.policies[0].violations[0];
    expect(v.when.type).toBe("and");
    expect(v.when.left.type).toBe("and");
  });

  it("rejects missing when clause", () => {
    const bad = `intent 2.0\npolicy X {\n  violation Bad confidence high {\n    severity error\n    message "oops"\n  }\n}`;
    expect(() => parsePolicy(bad)).toThrow(/missing.*when/i);
  });

  it("rejects missing severity", () => {
    const bad = `intent 2.0\npolicy X {\n  violation Bad confidence high {\n    when action.kind == "ModifyFile"\n    message "oops"\n  }\n}`;
    expect(() => parsePolicy(bad)).toThrow(/missing.*severity/i);
  });

  it("rejects missing message", () => {
    const bad = `intent 2.0\npolicy X {\n  violation Bad confidence high {\n    when action.kind == "ModifyFile"\n    severity error\n  }\n}`;
    expect(() => parsePolicy(bad)).toThrow(/missing.*message/i);
  });
});
