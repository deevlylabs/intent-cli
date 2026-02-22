// Main pipeline orchestration.
// Stateless: load specs → build action log → resolve scope → evaluate → emit output.

import { loadIntentFiles } from "./fs.mjs";
import { parseSystem } from "../intent/parser-system.mjs";
import { parsePolicy } from "../intent/parser-policy.mjs";
import { validateSystem, validatePolicy } from "../intent/validate.mjs";
import { buildActionLog } from "./actionlog.mjs";
import { resolveTaskScope } from "./taskscope.mjs";
import { evaluate } from "./evaluate.mjs";
import { buildPlanJson, writePlanJson } from "./planjson.mjs";
import { renderReport } from "./report.mjs";

/**
 * Run the full intent plan pipeline.
 * @param {Object} opts
 * @param {string} opts.repoRoot - Repository root path
 * @param {string} [opts.scope] - CLI --scope override
 * @param {string} [opts.base] - Diff base ref
 * @param {string} [opts.head] - Diff head ref
 * @param {string} [opts.outPath] - Output JSON path
 * @param {boolean} [opts.jsonOnly] - Only output JSON (no pretty report)
 * @returns {{ plan: Object, report: string, exitCode: number }}
 */
export function runPlan({ repoRoot, scope, base, head, outPath, jsonOnly }) {
  // 1. Load intent files
  const files = loadIntentFiles(repoRoot);

  // 2. Parse system.intent
  const systemSpec = parseSystem(files.systemSource, files.systemPath);
  const sysErrors = validateSystem(systemSpec);
  if (sysErrors.length > 0) {
    throw new Error(`Invalid system.intent:\n  ${sysErrors.join("\n  ")}`);
  }

  // 3. Parse policies
  const policySpecs = [];
  for (const pf of files.policyFiles) {
    const ps = parsePolicy(pf.source, pf.path);
    const pErrors = validatePolicy(ps);
    if (pErrors.length > 0) {
      throw new Error(`Invalid policy ${pf.path}:\n  ${pErrors.join("\n  ")}`);
    }
    policySpecs.push(ps);
  }

  // 4. Build action log (ModifyFile with hunks)
  const actions = buildActionLog({
    domains: systemSpec.domains,
    base,
    head,
    cwd: repoRoot,
  });

  // 5. Resolve task scope
  const task = resolveTaskScope({
    scopeOverride: scope,
    actions,
  });

  // 6. Evaluate policies
  const { violations, status } = evaluate({
    policySpecs,
    actions,
    task,
  });

  // 7. Build plan JSON
  const plan = buildPlanJson({
    intentVersion: systemSpec.intentVersion,
    status,
    task,
    actions,
    violations,
  });

  // 8. Write plan JSON
  const jsonPath = outPath ?? "intent.plan.json";
  writePlanJson(plan, jsonPath);

  // 9. Pretty report (uses raw violations with messages, not the stripped plan JSON)
  const report = jsonOnly
    ? JSON.stringify(plan, null, 2)
    : renderReport(
        { ...plan, violations },
        {
          intentVersion: systemSpec.intentVersion,
          systemName: systemSpec.systemName,
        },
      );

  const exitCode = status === "blocked" ? 1 : 0;

  return { plan, report, exitCode };
}
