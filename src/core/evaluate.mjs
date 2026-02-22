// Policy evaluation engine.
// Evaluates parsed policy violations against an action log + task scope.

/**
 * Evaluate all policies against the action log.
 * @param {Object} opts
 * @param {import('../intent/ast.mjs').PolicySpec[]} opts.policySpecs
 * @param {Object[]} opts.actions - Action log entries
 * @param {{ domain: string|null, tags: string[], source: string }} opts.task
 * @returns {{ violations: Object[], status: "pass"|"warn"|"blocked" }}
 */
export function evaluate({ policySpecs, actions, task }) {
  const violations = [];

  for (const spec of policySpecs) {
    for (const policy of spec.policies) {
      for (const rule of policy.violations) {
        for (const action of actions) {
          const ctx = buildContext(action, task);
          if (!evalPredicate(rule.when, ctx)) continue;

          const bypassed = checkBypass(rule, task);
          const effectiveSeverity = resolveEffectiveSeverity(rule.severity, rule.confidence, bypassed);

          violations.push({
            code: rule.code,
            severity: effectiveSeverity,
            confidence: rule.confidence,
            message: interpolateMessage(rule.message, ctx),
            suggest: rule.suggest ? interpolateMessage(rule.suggest, ctx) : null,
            evidence: buildEvidence(action, task),
            remediation: {
              actions: rule.suggest
                ? [interpolateMessage(rule.suggest, ctx)]
                : [],
              approved_interfaces: [],
            },
            bypassed: bypassed
              ? {
                  tag: rule.exceptWhenTagged,
                  approval_required: rule.requiresApproval ?? null,
                  approved: false,
                }
              : null,
          });
        }
      }
    }
  }

  const sevOrder = { error: 0, warn: 1, info: 2 };
  violations.sort((a, b) => {
    const sd = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
    if (sd !== 0) return sd;
    const pd = (a.evidence.path ?? "").localeCompare(b.evidence.path ?? "");
    if (pd !== 0) return pd;
    return a.code.localeCompare(b.code);
  });

  const status = computeStatus(violations, task);
  return { violations, status };
}

// ── Predicate evaluation ──────────────────────────────────────────

function buildContext(action, task) {
  return {
    "action.kind": action.kind,
    "action.path": action.path,
    "action.fileDomain": action.fileDomain,
    "file.domain": action.fileDomain,
    "file.path": action.path,
    "task.domain": task.domain,
    "task.tags": task.tags,
    "source.domain": action.sourceDomain ?? null,
    "source.path": action.sourcePath ?? null,
    "target.domain": action.targetDomain ?? null,
    "target.import": action.targetImport ?? null,
  };
}

function evalPredicate(node, ctx) {
  switch (node.type) {
    case "and":
      return evalPredicate(node.left, ctx) && evalPredicate(node.right, ctx);
    case "compare":
      return evalCompare(node.op, resolveValue(node.left, ctx), resolveValue(node.right, ctx));
    case "field":
      return ctx[node.path] != null;
    case "literal":
      return Boolean(node.value);
    case "null":
      return false;
    default:
      return false;
  }
}

function resolveValue(node, ctx) {
  switch (node.type) {
    case "field":
      return ctx[node.path] ?? null;
    case "literal":
      return node.value;
    case "null":
      return null;
    default:
      return null;
  }
}

function evalCompare(op, left, right) {
  if (op === "==") return left === right;
  if (op === "!=") return left !== right;
  return false;
}

// ── Bypass / exception logic ────────────────────────────────────────

function checkBypass(rule, task) {
  if (!rule.exceptWhenTagged) return false;
  return task.tags.includes(rule.exceptWhenTagged);
}

// ── Severity resolution with confidence ─────────────────────────────

function resolveEffectiveSeverity(severity, confidence, bypassed) {
  if (bypassed) return "warn";
  if (confidence === "medium" && severity === "error") return "warn";
  if (confidence === "low") return "info";
  return severity;
}

// ── Status computation ──────────────────────────────────────────────

function computeStatus(violations, task) {
  let status = "pass";

  for (const v of violations) {
    if (v.bypassed) {
      if (status === "pass") status = "warn";
      continue;
    }
    if (v.severity === "error" && v.confidence === "high") {
      status = "blocked";
    } else if (v.severity === "warn" || v.severity === "info") {
      if (status === "pass") status = "warn";
    }
  }

  if (task.source === "unknown" && status === "pass") {
    status = "warn";
  }

  return status;
}

// ── Evidence builder ────────────────────────────────────────────────

function buildEvidence(action, task) {
  const evidence = { path: action.path };
  if (action.fileDomain) evidence.file_domain = action.fileDomain;
  if (task.domain) evidence.task_domain = task.domain;
  if (action.hunks && action.hunks.length > 0) {
    evidence.first_hunk_line = action.hunks[0].newStart;
  }
  return evidence;
}

// ── Message interpolation ───────────────────────────────────────────

function interpolateMessage(template, ctx) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const val = ctx[key.trim()];
    return val != null ? String(val) : `<${key.trim()}>`;
  });
}
