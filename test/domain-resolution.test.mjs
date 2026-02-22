import { describe, it, expect } from "vitest";
import { globToRegex, resolveDomain } from "../src/core/glob.mjs";

describe("globToRegex", () => {
  it("matches ** wildcard (recursive)", () => {
    const re = globToRegex("app/auth/**");
    expect(re.test("app/auth/login.ts")).toBe(true);
    expect(re.test("app/auth/deep/nested/file.ts")).toBe(true);
    expect(re.test("app/auth")).toBe(false);
    expect(re.test("app/billing/x.ts")).toBe(false);
  });

  it("matches * wildcard (single segment)", () => {
    const re = globToRegex("src/*.mjs");
    expect(re.test("src/index.mjs")).toBe(true);
    expect(re.test("src/deep/index.mjs")).toBe(false);
  });

  it("matches ? wildcard", () => {
    const re = globToRegex("log?.txt");
    expect(re.test("log1.txt")).toBe(true);
    expect(re.test("logAB.txt")).toBe(false);
  });

  it("escapes regex special chars in patterns", () => {
    const re = globToRegex("src/(utils)/**");
    expect(re.test("src/(utils)/helpers.ts")).toBe(true);
  });
});

describe("resolveDomain", () => {
  const domains = [
    { name: "Identity", allowGlobs: ["app/auth/**", "lib/auth/**"] },
    { name: "Messaging", allowGlobs: ["app/messaging/**", "lib/messaging/**"] },
    { name: "Billing", allowGlobs: ["app/billing/**"] },
  ];

  it("resolves a file to the correct domain", () => {
    expect(resolveDomain("app/auth/login.ts", domains)).toBe("Identity");
    expect(resolveDomain("app/messaging/handler.ts", domains)).toBe("Messaging");
    expect(resolveDomain("app/billing/invoice.ts", domains)).toBe("Billing");
  });

  it("returns null for unmapped files", () => {
    expect(resolveDomain("app/unknown/file.ts", domains)).toBeNull();
    expect(resolveDomain("README.md", domains)).toBeNull();
  });

  it("uses most-specific match (longest glob)", () => {
    const overlapping = [
      { name: "Broad", allowGlobs: ["app/**"] },
      { name: "Specific", allowGlobs: ["app/auth/**"] },
    ];
    expect(resolveDomain("app/auth/login.ts", overlapping)).toBe("Specific");
  });

  it("breaks ties lexicographically by domain name", () => {
    const tied = [
      { name: "Zeta", allowGlobs: ["shared/**"] },
      { name: "Alpha", allowGlobs: ["shared/**"] },
    ];
    expect(resolveDomain("shared/util.ts", tied)).toBe("Alpha");
  });

  it("resolves deeply nested paths", () => {
    expect(resolveDomain("app/auth/middleware/jwt/validate.ts", domains)).toBe("Identity");
  });
});
