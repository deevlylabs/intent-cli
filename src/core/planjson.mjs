// Build the intent.plan.json output (stable schema, deterministic).

import { writeFileSync } from "node:fs";

/**
 * Build plan JSON object conforming to PLAN-JSON.md schema.
 */
export function buildPlanJson({ intentVersion, status, task, actions, violations }) {
  return {
    intent_version: intentVersion ?? "2.0",
    status,
    task: {
      domain: task.domain ?? null,
      tags: task.tags ?? [],
      source: task.source ?? "unknown",
    },
    actions_summary: {
      modify_files: actions.filter((a) => a.kind === "ModifyFile").length,
      import_cross_domain: actions.filter((a) => a.kind === "ImportCrossDomain").length,
    },
    violations: violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      confidence: v.confidence,
      evidence: v.evidence,
      remediation: v.remediation ?? { actions: [], approved_interfaces: [] },
      bypassed: v.bypassed ?? null,
    })),
  };
}

/**
 * Write plan JSON to disk.
 */
export function writePlanJson(plan, outPath = "intent.plan.json") {
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n");
}
