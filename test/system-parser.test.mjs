import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSystem } from "../src/intent/parser-system.mjs";

const FIXTURE = readFileSync(join(import.meta.dirname, "fixtures/system.intent"), "utf-8");

describe("system parser", () => {
  it("parses the fixture system.intent", () => {
    const spec = parseSystem(FIXTURE, "test/fixtures/system.intent");
    expect(spec.kind).toBe("SystemSpec");
    expect(spec.intentVersion).toBe("2.0");
    expect(spec.systemName).toBe("TestApp");
  });

  it("extracts imports", () => {
    const spec = parseSystem(FIXTURE);
    expect(spec.imports).toEqual([
      "contracts/core.intent",
      "policies/default.intent",
    ]);
  });

  it("extracts all domains", () => {
    const spec = parseSystem(FIXTURE);
    expect(spec.domains).toHaveLength(3);

    const names = spec.domains.map((d) => d.name);
    expect(names).toEqual(["Identity", "Messaging", "Billing"]);
  });

  it("extracts path globs per domain", () => {
    const spec = parseSystem(FIXTURE);
    const identity = spec.domains.find((d) => d.name === "Identity");
    expect(identity.allowGlobs).toEqual(["app/auth/**", "lib/auth/**"]);
  });

  it("extracts depends_on", () => {
    const spec = parseSystem(FIXTURE);
    const messaging = spec.domains.find((d) => d.name === "Messaging");
    expect(messaging.dependsOn).toEqual(["Identity"]);
  });

  it("rejects missing intent version", () => {
    expect(() => parseSystem("system Foo")).toThrow();
  });

  it("rejects empty input", () => {
    expect(() => parseSystem("")).toThrow();
  });

  it("parses a minimal valid spec", () => {
    const src = `intent 2.0\nsystem Minimal\ndomain Core {\n  paths allow "src/**"\n}`;
    const spec = parseSystem(src);
    expect(spec.systemName).toBe("Minimal");
    expect(spec.domains).toHaveLength(1);
    expect(spec.domains[0].allowGlobs).toEqual(["src/**"]);
  });
});
