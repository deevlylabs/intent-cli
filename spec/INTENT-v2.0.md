# INTENT v2.0 Specification

## 0) Normative language
- **MUST**: required for compliance
- **SHOULD**: recommended
- **MAY**: optional

## 1) Design principles
1. Human approval: the system MUST support an approval workflow (direct or via GitHub).
2. Stateless PR evaluation: decisions MUST be computed from `intent files + PR diff (+ optional AST)` without a mutable state file in the repo.
3. Uncertainty handling: the engine MUST NOT hard-block on low/medium confidence signals; it MUST warn and/or request approval.
4. Deterministic outputs: the engine MUST output machine-readable remediation with a stable schema.

## 2) File layering model
### 2.1 system.intent (Structural Map)
MUST support:
- `intent <version>`
- `system <Name>`
- `import "<path>"`
- `domain <Name> { ... }` with:
  - `paths allow "<glob>", ...`
  - `owns contracts ...` (optional for v2.0 enforcement)
  - `exposes ...` (optional for v2.0 enforcement)
  - `depends_on ...` (optional for v2.0 enforcement)

### 2.2 contracts/*.intent (Contracts)
MUST support:
- `type <SemanticType>`
- `contract <Ref> v<N> stability <stable|beta|experimental> { fields {...} operations {...} }`

In v2.0, contracts are used primarily for documentation + remediation references.

### 2.3 policies/*.intent (Policies)
MUST support:
- `policy <Name> { ... }`
- `violation <Name> confidence <high|medium|low> { when ... severity ... message ... }`
- optional: `suggest`, `requires_approval`, `except_when tagged ...`, `auto_fix`

## 3) Task scope model
### 3.1 task.domain
`task.domain` MUST be injected from PR metadata.

Recommended sources (priority):
1) PR description header `INTENT-SCOPE: <Domain>`
2) linked issue label `domain:<Domain>`
3) slash command comment `/intent scope <Domain>`
4) inference fallback (majority touched domain) → MUST be `confidence=medium`

If scope cannot be resolved, engine MUST warn and request a scope assignment.

### 3.2 task.tags
`task.tags` MUST be injectable from PR metadata/labels.
Used for exceptions: `except_when tagged "<tag>"`.

## 4) Action model (typed PR events)
Policies evaluate over a typed Action Log.

v2.0 MUST support:
- ModifyFile (diff-based)

v2.0 SHOULD support:
- ImportCrossDomain (AST-based)

See `spec/ACTION-LOG.md`.

## 5) Domain mapping semantics
### 5.1 paths allow
A file's domain MUST be resolved by matching its path against domain patterns.

Overlaps:
- Engine SHOULD pick the most specific match (deepest/longest).
- Engine MUST be deterministic.

If no match → `file.domain = null`.

## 6) Policy evaluation semantics
### 6.1 Confidence semantics
- high: MAY hard-block when severity=error (status=blocked)
- medium: MUST NOT hard-block by default; MUST warn and/or require approval
- low: informational only

### 6.2 Exceptions & tags
`except_when tagged "<tag>"` bypasses a violation ONLY if:
- tag exists in `task.tags`
- and any approval requirement is satisfied

Runtime MUST include bypass info in machine output for auditability.

### 6.3 Placeholders
Policy strings MAY include placeholders like `{file.domain}`, `{task.domain}`, etc.
Runtime MUST resolve placeholders consistently.

## 7) Outputs (dual output requirement)
For every evaluation, runtime MUST output:
1) Human-readable report (comment/log)
2) Machine-readable remediation JSON (`intent.plan.json`)

## 8) Non-goals for v2.0
- full architecture reconciliation
- DBWrite/APICall semantic extraction
- polyglot deep enforcement
