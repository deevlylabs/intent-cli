// AST node constructors for the INTENT DSL.

// ── System AST ──────────────────────────────────────────────────────

export function systemSpec({ intentVersion, systemName, imports, domains }) {
  return { kind: "SystemSpec", intentVersion, systemName, imports: imports ?? [], domains };
}

export function domainNode({ name, allowGlobs, dependsOn }) {
  return { name, allowGlobs, dependsOn: dependsOn ?? [] };
}

// ── Policy AST ──────────────────────────────────────────────────────

export function policySpec({ intentVersion, policies }) {
  return { kind: "PolicySpec", intentVersion, policies };
}

export function policyNode({ name, violations }) {
  return { name, violations };
}

export function violationNode({
  code,
  confidence,
  severity,
  when: predicate,
  message,
  suggest,
  exceptWhenTagged,
  requiresApproval,
  autoFix,
}) {
  return {
    code,
    confidence,
    severity,
    when: predicate,
    message,
    suggest: suggest ?? null,
    exceptWhenTagged: exceptWhenTagged ?? null,
    requiresApproval: requiresApproval ?? null,
    autoFix: autoFix ?? null,
  };
}

// ── Predicate AST ───────────────────────────────────────────────────

export function andExpr(left, right) {
  return { type: "and", left, right };
}

export function compareExpr(op, left, right) {
  return { type: "compare", op, left, right };
}

export function fieldRef(path) {
  return { type: "field", path };
}

export function literal(value) {
  return { type: "literal", value };
}

export function nullLiteral() {
  return { type: "null" };
}
