# INTENT v2.0-core — Formal Model

Version 2.0.0 — February 2026

---

## 1. Language Overview

INTENT is a declarative domain-specific language for expressing architectural domain boundaries and policy constraints over source code repositories.

### Purpose

INTENT defines:

1. **Domains** — named partitions of a codebase, each mapped to a set of file path patterns.
2. **Policies** — named sets of violation rules, each with a predicate, severity, and confidence level.

An INTENT runtime evaluates a git diff against these declarations and produces a deterministic set of violations.

### Separation of language and runtime

The INTENT DSL is defined independently of any runtime. A conforming runtime MUST:

- Parse the DSL into an abstract syntax tree.
- Evaluate policies over a typed action log derived from git diff output.
- Produce a stable JSON output conforming to the plan schema.

The reference runtime is implemented in Node.js (ECMAScript modules, Node >= 18). Alternative runtimes may be implemented in any language provided they conform to the same evaluation semantics and output schema.

### Scope of v2.0-core

v2.0-core operates at **file-path granularity**. It determines which domain a file belongs to based on glob pattern matching. It does not analyze file contents, import graphs, or type systems.

---

## 2. Grammar Overview

INTENT uses two file types with distinct grammars sharing a common lexical structure.

### 2.1 Lexical structure

The tokenizer recognizes:

| Token class | Examples |
|---|---|
| KEYWORD | `intent`, `system`, `domain`, `import`, `paths`, `allow`, `depends_on`, `policy`, `violation`, `confidence`, `when`, `severity`, `message`, `suggest`, `except_when`, `tagged`, `requires_approval`, `auto_fix`, `null`, `high`, `medium`, `low`, `error`, `warn`, `info` |
| IDENT | Any `[a-zA-Z_][a-zA-Z0-9_]*` not in the keyword set |
| STRING | Double-quoted, with `\` escape: `"app/auth/**"` |
| NUMBER | `[0-9]+(\.[0-9]+)?` — used for version declarations |
| Operators | `==`, `!=`, `&&` |
| Punctuation | `{`, `}`, `(`, `)`, `,`, `:`, `.`, `->`, `?` |
| Comment | `//` to end of line (discarded) |
| Newline | Significant as statement delimiter within blocks |

Whitespace (space, tab, carriage return) outside strings is ignored. Newlines are tracked as tokens to delimit directives within blocks.

### 2.2 `system.intent` grammar

```
SystemFile     = VersionDecl SystemDecl Import* Domain*
VersionDecl    = "intent" NUMBER
SystemDecl     = "system" IDENT
Import         = "import" STRING
Domain         = "domain" IDENT "{" DomainBody "}"
DomainBody     = (PathsAllow | DependsOn)*
PathsAllow     = "paths" "allow" STRING ("," STRING)*
DependsOn      = "depends_on" IDENT
```

Semantics:

- `VersionDecl` — MUST be `"2.0"` for v2.0-core.
- `SystemDecl` — names the system. Informational; does not affect evaluation.
- `Import` — declares a file dependency. The reference runtime does not resolve imports during evaluation; they are metadata.
- `Domain` — declares a named domain with one or more glob patterns.
- `DependsOn` — declares a dependency relationship. Informational in v2.0-core; does not affect evaluation.

### 2.3 `policies/*.intent` grammar

```
PolicyFile     = VersionDecl Policy*
Policy         = "policy" IDENT "{" Violation* "}"
Violation      = "violation" IDENT "confidence" ConfLevel "{" ViolationBody "}"
ConfLevel      = "high" | "medium" | "low"
ViolationBody  = WhenClause SeverityClause MessageClause OptionalClauses*
WhenClause     = "when" Predicate
SeverityClause = "severity" SevLevel
SevLevel       = "error" | "warn" | "info"
MessageClause  = "message" STRING
OptionalClauses = SuggestClause | ExceptClause | ApprovalClause | AutoFixClause
SuggestClause  = "suggest" STRING
ExceptClause   = "except_when" "tagged" STRING ("requires_approval" STRING)?
ApprovalClause = "requires_approval" STRING
AutoFixClause  = "auto_fix" STRING
```

### 2.4 Predicate grammar

```
Predicate      = Comparison ("&&" Comparison)*
Comparison     = Atom CompOp Atom
CompOp         = "==" | "!="
Atom           = FieldRef | StringLiteral | "null"
FieldRef       = IDENT ("." IDENT)*
StringLiteral  = STRING
```

Predicates are conjunction-only (no disjunction, no negation beyond `!=`, no parenthesized grouping).

### 2.5 Predicate field namespace

The following field paths are defined for predicate evaluation:

| Field | Type | Source |
|---|---|---|
| `action.kind` | string | Action type: `"ModifyFile"` or `"ImportCrossDomain"` |
| `action.path` | string | File path (POSIX-normalized) |
| `action.fileDomain` | string or null | Resolved domain of the file |
| `file.domain` | string or null | Alias for `action.fileDomain` |
| `file.path` | string | Alias for `action.path` |
| `task.domain` | string or null | Resolved task scope domain |
| `task.tags` | string[] | Tags from PR metadata |
| `source.domain` | string or null | Source domain (ImportCrossDomain only) |
| `target.domain` | string or null | Target domain (ImportCrossDomain only) |

Field references to undefined paths resolve to `null`.

### 2.6 Message interpolation

Strings in `message` and `suggest` clauses support placeholder interpolation:

```
"PR touches {file.domain} but task is scoped to {task.domain}: {file.path}"
```

Placeholders use the same field namespace as predicates. Unresolvable placeholders render as `<field.name>`.

### 2.7 What is NOT supported in v2.0-core

- No disjunction (`||`) in predicates.
- No negation operator (`!`) — only `!=` comparison.
- No parenthesized grouping in predicates.
- No arithmetic expressions.
- No list membership (`in`) operator.
- No regular expression matching in predicates.
- No user-defined functions or macros.
- No conditional blocks or control flow.
- No cross-file references in predicates (each action is evaluated independently).

---

## 3. Execution Model

### 3.1 Inputs

An INTENT evaluation requires exactly:

| Input | Source | Required |
|---|---|---|
| `system.intent` | Repository file | Yes |
| `policies/*.intent` | Repository files | Yes (0..N; 0 policies produces a warning) |
| Base commit ref | Git ref or SHA | Yes |
| Head commit ref | Git ref or SHA | Yes |
| Task scope metadata | PR body, labels, CLI flag, or inference | Optional |

No other inputs affect evaluation. No network calls. No file system state beyond the repository.

### 3.2 Pipeline

The evaluation pipeline consists of nine ordered steps. Each step is a pure function of its inputs (except Step 4 which invokes `git diff`).

```
Step 1: Parse system.intent    → SystemSpec AST
Step 2: Validate SystemSpec    → errors or proceed
Step 3: Parse policies/*.intent → PolicySpec[] ASTs
Step 4: Extract git diff       → raw unified diff text
Step 5: Build Action Log       → ModifyFile[] with fileDomain resolved
Step 6: Resolve Task Scope     → { domain, tags, source }
Step 7: Evaluate policies      → ViolationInstance[]
Step 8: Sort violations        → deterministic order
Step 9: Emit output            → intent.plan.json + human report
```

### Step 1: Parse `system.intent`

Input: source text.
Output: `SystemSpec` AST node:

```
SystemSpec {
  kind: "SystemSpec"
  intentVersion: string
  systemName: string
  imports: string[]
  domains: DomainNode[]
}

DomainNode {
  name: string
  allowGlobs: string[]
  dependsOn: string[]
}
```

Parse errors MUST include file path, line number, and column number.

### Step 2: Validate `SystemSpec`

Validation rules:
- `intentVersion` MUST be present.
- `systemName` MUST be present.
- At least one domain MUST be declared.
- Domain names MUST be unique.
- Each domain MUST have at least one `paths allow` glob.
- `depends_on` references MUST resolve to declared domain names.

Validation failures are fatal. The pipeline terminates with exit code 2.

### Step 3: Parse `policies/*.intent`

Input: source text of each policy file, sorted lexicographically by filename.
Output: `PolicySpec[]` ASTs:

```
PolicySpec {
  kind: "PolicySpec"
  intentVersion: string
  policies: PolicyNode[]
}

PolicyNode {
  name: string
  violations: ViolationNode[]
}

ViolationNode {
  code: string
  confidence: "high" | "medium" | "low"
  severity: "error" | "warn" | "info"
  when: PredicateAST
  message: string
  suggest: string | null
  exceptWhenTagged: string | null
  requiresApproval: string | null
  autoFix: string | null
}
```

Predicate AST:

```
PredicateAST =
  | { type: "and", left: PredicateAST, right: PredicateAST }
  | { type: "compare", op: "==" | "!=", left: ValueAST, right: ValueAST }

ValueAST =
  | { type: "field", path: string }
  | { type: "literal", value: string }
  | { type: "null" }
```

Validation: within a policy, violation codes MUST be unique.

### Step 4: Extract git diff

Input: base ref, head ref, repository path.
Output: raw unified diff text.

The runtime invokes:

```
git diff --unified=3 --no-color <base>...<head>
```

If three-dot diff fails, falls back to two-dot:

```
git diff --unified=3 --no-color <base> <head>
```

This is the only step with a side effect (subprocess invocation).

### Step 5: Build Action Log

Input: raw diff text, domain list from SystemSpec.
Output: `ModifyFile[]`.

The diff is parsed into file entries. Each file entry is:

```
ModifyFile {
  kind: "ModifyFile"
  path: string          (POSIX-normalized)
  fileDomain: string | null
  hunks: Hunk[]
}

Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
}
```

Domain resolution is applied per file (see Section 3.3).

File ordering follows diff output order (stable, determined by git).

### Step 6: Resolve Task Scope

Input: metadata sources, action log.
Output: `TaskScope { domain, tags, source }`.

See Section 6 for the full algorithm.

### Step 7: Evaluate policies

Input: PolicySpec[], ModifyFile[], TaskScope.
Output: ViolationInstance[].

For each policy spec, for each policy, for each violation rule, for each action:

```
ctx = buildContext(action, task)
if evalPredicate(rule.when, ctx):
    emit ViolationInstance
```

See Section 7 for evaluation semantics.

### Step 8: Sort violations

Violations are sorted by:

1. Severity: `error` < `warn` < `info` (errors first)
2. File path: lexicographic ascending
3. Rule code: lexicographic ascending

This ordering is deterministic and stable.

### Step 9: Emit output

Two outputs are produced:

1. `intent.plan.json` — written to disk (see Section 8).
2. Human-readable report — written to stdout.

If `--json` flag is set, only JSON is written to stdout.

### 3.3 Domain resolution algorithm

Given a file path `p` and a list of domains `D`, each with glob patterns:

```
function resolveDomain(p, D):
    best ← null
    bestLen ← -1
    for each domain d in D:
        for each pattern g in d.allowGlobs:
            if matches(g, p):
                if length(g) > bestLen:
                    best ← d.name
                    bestLen ← length(g)
                else if length(g) == bestLen:
                    if d.name < best:   // lexicographic
                        best ← d.name
    return best   // null if no match
```

Pattern specificity is determined by string length of the glob pattern. This is a heuristic: longer patterns are assumed to be more specific.

Tie-breaking by domain name ensures determinism when two domains have patterns of equal length matching the same file.

### 3.4 Glob semantics

Glob patterns are converted to regular expressions:

| Glob | Regex | Matches |
|---|---|---|
| `**` (at end) | `.*` | Any path suffix |
| `**/` (followed by more) | `(?:.+/)?` | Zero or more directory levels |
| `*` | `[^/]*` | Any characters within a single path segment |
| `?` | `[^/]` | Any single character within a path segment |
| Other chars | Escaped | Literal match |

The resulting regex is anchored: `^<pattern>$`.

---

## 4. Action Log Model

The Action Log is the central abstraction in INTENT evaluation. Policies do not operate on raw diffs or file contents. They operate on typed action records.

### 4.1 Why an Action Log

The Action Log provides:

1. **Abstraction** — Policies are decoupled from git diff format. A different VCS could produce the same action types.
2. **Typed evaluation** — Each action has a `kind` discriminator. Predicates filter on `action.kind`, enabling different rules for different action types.
3. **Extensibility** — New action kinds (e.g. `ImportCrossDomain`, `DBWrite`) can be added without changing the evaluation engine. Policy predicates naturally filter by `action.kind`.

### 4.2 `ModifyFile` (v2.0-core, MUST)

```
ModifyFile {
  kind:       "ModifyFile"
  path:       string          POSIX-normalized relative path from repo root
  fileDomain: string | null   resolved via domain map; null if unmapped
  hunks:      Hunk[]          may be empty if only --name-only was available
}

Hunk {
  oldStart:   number          line number in base version
  oldLines:   number          count of lines in base hunk
  newStart:   number          line number in head version
  newLines:   number          count of lines in head hunk
}
```

One `ModifyFile` action is emitted per file entry in the diff. Ordering matches diff output order.

### 4.3 `ImportCrossDomain` (v2.0-core, NOT implemented)

Defined in the spec for forward compatibility:

```
ImportCrossDomain {
  kind:         "ImportCrossDomain"
  sourcePath:   string
  sourceDomain: string | null
  targetImport: string
  targetDomain: string | null
  confidence:   "high" | "medium"
}
```

v2.0-core does not produce this action type. Policy rules with `when action.kind == "ImportCrossDomain"` will never trigger in v2.0-core. This is intentional — rules can be authored ahead of the runtime support.

---

## 5. Determinism Guarantees

INTENT v2.0-core provides the following determinism properties:

### 5.1 Output determinism

Given identical inputs (same `system.intent`, same `policies/*.intent`, same git diff, same task scope), the output MUST be byte-identical.

This requires:

- **Violation sorting** — fixed ordering: severity, then file path, then rule code.
- **JSON serialization** — fixed key order matching the schema definition. 2-space indentation. Trailing newline.
- **No timestamps** — no fields in the output depend on wall clock time.
- **No random identifiers** — no UUIDs, no nonces, no counters that depend on invocation.

### 5.2 Policy file ordering

Policy files are loaded in lexicographic order by filename. Within a policy file, violation rules are evaluated in declaration order. This ordering affects which violations appear first when multiple rules match the same action, but does not affect the final sorted output.

### 5.3 Domain resolution determinism

When multiple domains match a file:
- Longest pattern wins (by string length).
- On tie: lexicographically first domain name wins.

### 5.4 Environment independence

The only external dependency is `git diff`. The evaluation does not read:

- Environment variables (except for metadata injection: `DIFF_BASE`, `DIFF_HEAD`, `GITHUB_EVENT_PATH`, `PR_BODY`, `CHANGED_FILES`).
- Network resources.
- File system state outside the repository root.
- System clock (no timestamps in output).

### 5.5 Floating-point

No floating-point arithmetic is used in evaluation. All comparisons are string equality or string ordering.

---

## 6. Scope Resolution Algorithm

Task scope determines which domain the current PR is intended to modify. It is resolved from multiple sources with a fixed priority order.

### 6.1 Resolution procedure

```
function resolveTaskScope(cliOverride, prBody, labels, actions):
    tags ← parseTags(prBody)

    // Priority 1: CLI override
    if cliOverride is not null:
        return { domain: cliOverride, tags, source: "cli_override" }

    // Priority 2: PR body header
    if prBody matches /^INTENT-SCOPE:\s*(\S+)/m:
        return { domain: match[1], tags, source: "pr_header" }

    // Priority 3: Issue/PR labels
    for each label in labels:
        if label matches /^domain:(\S+)$/:
            return { domain: match[1], tags, source: "issue_label" }

    // Priority 4: Slash command in PR body
    if prBody matches /^\/intent\s+scope\s+(\S+)/m:
        return { domain: match[1], tags, source: "slash_command" }

    // Priority 5: Inference from action log
    inferred ← inferDomain(actions)
    if inferred is not null:
        return { domain: inferred, tags, source: "inferred" }

    // No scope resolved
    return { domain: null, tags, source: "unknown" }
```

### 6.2 Inference algorithm

```
function inferDomain(actions):
    counts ← empty map<string, number>
    for each action in actions:
        if action.fileDomain is not null:
            counts[action.fileDomain] += 1

    if counts is empty:
        return null

    // Sort by count descending, then name ascending (tie-break)
    entries ← sort(counts.entries(), by: (-count, name))
    return entries[0].name
```

Tie-breaking: when two domains have equal file counts, the lexicographically smaller domain name is selected. This ensures determinism.

### 6.3 Tag extraction

```
function parseTags(prBody):
    if prBody matches /^INTENT-TAGS:\s*(.+)/m:
        return split(match[1], ",").map(trim).filter(nonEmpty)
    return []
```

### 6.4 Unknown scope behavior

When `task.domain` is `null` and `task.source` is `"unknown"`:

- Predicates comparing against `task.domain` where `task.domain` is operand to `!=` will evaluate `X != null` as `true` for any non-null X. Policy authors should include `task.domain != null` in predicates that compare `file.domain != task.domain`.
- The overall status is downgraded from `pass` to `warn` if no other violations exist.

---

## 7. Evaluation Semantics

### 7.1 Evaluation loop

```
function evaluate(policySpecs, actions, task):
    violations ← []

    for each spec in policySpecs:
        for each policy in spec.policies:
            for each rule in policy.violations:
                for each action in actions:
                    ctx ← buildContext(action, task)
                    if evalPredicate(rule.when, ctx):
                        bypassed ← checkBypass(rule, task)
                        severity ← resolveEffectiveSeverity(rule.severity, rule.confidence, bypassed)
                        violations.append(makeViolation(rule, action, task, severity, bypassed, ctx))

    sort(violations)
    status ← computeStatus(violations, task)
    return { violations, status }
```

### 7.2 Predicate evaluation

```
function evalPredicate(node, ctx):
    case node.type:
        "and":     return evalPredicate(node.left, ctx) AND evalPredicate(node.right, ctx)
        "compare": return evalCompare(node.op, resolve(node.left, ctx), resolve(node.right, ctx))
        "field":   return ctx[node.path] is not null
        "literal": return Boolean(node.value)
        "null":    return false

function resolve(node, ctx):
    case node.type:
        "field":   return ctx[node.path]    // null if undefined
        "literal": return node.value
        "null":    return null

function evalCompare(op, left, right):
    case op:
        "==": return left === right          // strict equality
        "!=": return left !== right          // strict inequality
```

All comparisons use strict equality. `null === null` is `true`. `"X" === null` is `false`. `"X" !== null` is `true`.

### 7.3 Context construction

For each (action, task) pair:

```
function buildContext(action, task):
    return {
        "action.kind":       action.kind,
        "action.path":       action.path,
        "action.fileDomain": action.fileDomain,
        "file.domain":       action.fileDomain,     // alias
        "file.path":         action.path,            // alias
        "task.domain":       task.domain,
        "task.tags":         task.tags,
        "source.domain":     action.sourceDomain,    // null for ModifyFile
        "source.path":       action.sourcePath,      // null for ModifyFile
        "target.domain":     action.targetDomain,    // null for ModifyFile
        "target.import":     action.targetImport,    // null for ModifyFile
    }
```

### 7.4 Bypass logic

```
function checkBypass(rule, task):
    if rule.exceptWhenTagged is null:
        return false
    return rule.exceptWhenTagged in task.tags
```

A bypassed violation is still emitted. It is not suppressed. The `bypassed` field in the output records the bypass for auditability.

### 7.5 Effective severity resolution

```
function resolveEffectiveSeverity(declaredSeverity, confidence, bypassed):
    if bypassed:
        return "warn"
    if confidence == "medium" and declaredSeverity == "error":
        return "warn"
    if confidence == "low":
        return "info"
    return declaredSeverity
```

This table summarizes the mapping:

| Declared severity | Confidence | Bypassed | Effective severity |
|---|---|---|---|
| error | high | no | error |
| error | high | yes | warn |
| error | medium | no | warn |
| error | medium | yes | warn |
| error | low | no | info |
| error | low | yes | info |
| warn | high | no | warn |
| warn | high | yes | warn |
| warn | medium | no | warn |
| warn | low | no | info |
| info | any | any | info |

### 7.6 Status computation

```
function computeStatus(violations, task):
    status ← "pass"

    for each v in violations:
        if v.bypassed is not null:
            if status == "pass":
                status ← "warn"
            continue
        if v.severity == "error" and v.confidence == "high":
            status ← "blocked"
        else if v.severity in {"warn", "info"}:
            if status == "pass":
                status ← "warn"

    if task.source == "unknown" and status == "pass":
        status ← "warn"

    return status
```

Status transitions: `pass → warn → blocked`. Status never downgrades.

### 7.7 Violation sorting

```
function sortViolations(violations):
    sort by:
        1. severity order: error=0, warn=1, info=2 (ascending)
        2. evidence.path: lexicographic ascending
        3. code: lexicographic ascending
```

---

## 8. Plan JSON Schema

### 8.1 Top-level object

```json
{
  "intent_version": "2.0",
  "status": "pass | warn | blocked",
  "task": { ... },
  "actions_summary": { ... },
  "violations": [ ... ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `intent_version` | string | Yes | Always `"2.0"` for this release. |
| `status` | enum | Yes | One of `"pass"`, `"warn"`, `"blocked"`. |
| `task` | object | Yes | Resolved task scope. |
| `actions_summary` | object | Yes | Counts of actions by type. |
| `violations` | array | Yes | Ordered list of violations. May be empty. |

### 8.2 `task` object

```json
{
  "domain": "Identity",
  "tags": ["intentional-cross-domain"],
  "source": "pr_header"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `domain` | string or null | Yes | Domain name, or `null` if unresolved. |
| `tags` | string[] | Yes | May be empty. |
| `source` | string | Yes | One of: `"cli_override"`, `"pr_header"`, `"issue_label"`, `"slash_command"`, `"inferred"`, `"unknown"`. |

### 8.3 `actions_summary` object

```json
{
  "modify_files": 3,
  "import_cross_domain": 0
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `modify_files` | number | Yes | Count of `ModifyFile` actions. |
| `import_cross_domain` | number | Yes | Count of `ImportCrossDomain` actions. Always `0` in v2.0-core. |

### 8.4 `violations` array element

```json
{
  "code": "CrossDomainTouch",
  "severity": "error",
  "confidence": "high",
  "evidence": {
    "path": "src/billing/invoice.ts",
    "file_domain": "Billing",
    "task_domain": "Identity",
    "first_hunk_line": 12
  },
  "remediation": {
    "actions": ["Split into separate PR."],
    "approved_interfaces": []
  },
  "bypassed": null
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | Violation rule name. |
| `severity` | string | Yes | Effective severity after confidence/bypass resolution. |
| `confidence` | string | Yes | Original confidence from rule declaration. |
| `evidence` | object | Yes | See below. |
| `remediation` | object | Yes | See below. |
| `bypassed` | object or null | Yes | `null` if not bypassed. |

### 8.5 `evidence` object

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | Yes | File path that triggered the violation. |
| `file_domain` | string | No | Present when the file has a resolved domain. |
| `task_domain` | string | No | Present when the task has a resolved domain. |
| `first_hunk_line` | number | No | First changed line number, if hunks are available. |

### 8.6 `remediation` object

| Field | Type | Required | Description |
|---|---|---|---|
| `actions` | string[] | Yes | Suggested actions. May be empty. |
| `approved_interfaces` | string[] | Yes | Reserved for contract-based suggestions. Always empty in v2.0-core. |

### 8.7 `bypassed` object (when non-null)

| Field | Type | Required | Description |
|---|---|---|---|
| `tag` | string | Yes | The tag that triggered the bypass. |
| `approval_required` | string or null | Yes | Role required for approval, or `null`. |
| `approved` | boolean | Yes | Always `false` in v2.0-core (approval tracking is external). |

---

## 9. Non-Goals (v2.0-core)

The following are explicitly out of scope for v2.0-core. These are not limitations to be worked around — they are deliberate design boundaries.

### 9.1 No contract enforcement

`contracts/*.intent` files are parsed for forward compatibility but do not affect evaluation. The `approved_interfaces` field in `remediation` is always empty. Contract-based remediation suggestions are not generated.

### 9.2 No import graph analysis

v2.0-core does not parse source code. It does not produce `ImportCrossDomain` actions. Cross-domain imports are not detected. Rules targeting `action.kind == "ImportCrossDomain"` will never fire.

### 9.3 No cross-language type checking

INTENT does not analyze type systems. It does not resolve types, interfaces, or function signatures across files or domains. Domain membership is determined solely by file path.

### 9.4 No runtime enforcement

INTENT is a static analysis tool. It runs at PR time. It does not instrument application code, intercept function calls, or enforce boundaries at runtime.

### 9.5 No approval state tracking

The `bypassed.approved` field exists in the schema but is always `false`. Approval workflows (checking whether a tech-lead has approved a bypassed violation) are the responsibility of external systems (e.g. GitHub review requirements). INTENT reports what needs approval; it does not track whether approval has been granted.

### 9.6 No drift detection

v2.0-core evaluates individual diffs. It does not compare the current repository state against the declared architecture to detect accumulated drift. Each evaluation is independent.

---

## 10. Future Extension Points

The following extension points are defined in the v2.0 specification or implied by the architecture. They are documented here for implementors of alternative runtimes or future versions.

### 10.1 `ImportCrossDomain` action kind

The action log model defines `ImportCrossDomain` with fields for source/target domain and confidence. A future runtime may produce these actions via AST parsing (e.g. Tree-sitter). Policy rules targeting this action kind are already expressible in v2.0-core — they simply never match.

### 10.2 Contract model

The DSL supports `contract <Ref> v<N> stability <level> { fields {...} operations {...} }`. A future version may build a symbol table from contracts and use it to:

- Validate that `remediation.approved_interfaces` references are real.
- Generate remediation suggestions that reference specific contract operations.
- Enforce that cross-domain access uses declared public interfaces.

### 10.3 Typed dependency enforcement

`depends_on` declarations exist in `system.intent`. A future version may enforce that cross-domain references follow declared dependency edges (A depends_on B means A may use B's public contracts, but not vice versa).

### 10.4 Multi-language analysis

The glob-based domain model is language-agnostic. A future runtime could add language-specific analyzers that produce richer action types (e.g. `TypeImport`, `FunctionCall`, `DBQuery`) while sharing the same policy evaluation engine.

### 10.5 `intent scan` bootstrap

A future command may scan an existing repository and generate `system.intent` by analyzing directory structure, package boundaries, and import patterns. The current `intent init` command performs a simpler version of this (directory-based inference only).

### 10.6 Additional predicate operators

The predicate grammar could be extended with:

- `||` (disjunction)
- `in` (list membership, e.g. `file.domain in ["Billing", "Payments"]`)
- Parenthesized grouping
- `matches` (regex matching)

These would require lexer and parser changes but no changes to the evaluation architecture.

---

## Appendix A: Exit Codes

| Code | Meaning |
|---|---|
| 0 | Evaluation completed. Status is `pass` or `warn`. |
| 1 | Evaluation completed. Status is `blocked`. |
| 2 | Engine error. Evaluation did not complete (parse error, missing files, git error). |

### Appendix B: Reference Implementation File Map

```
src/
  intent/
    lexer.mjs          Tokenizer (shared by all parsers)
    ast.mjs            AST node constructors
    parser-system.mjs  system.intent → SystemSpec
    parser-policy.mjs  policies/*.intent → PolicySpec
    validate.mjs       AST validation
  core/
    fs.mjs             Repository discovery, file loading
    glob.mjs           Glob-to-regex, domain resolution
    git.mjs            Git diff invocation and parsing
    actionlog.mjs      Action log construction
    taskscope.mjs      Task scope resolution
    evaluate.mjs       Policy evaluation engine
    planjson.mjs       Plan JSON builder
    report.mjs         Human-readable report renderer
    index.mjs          Pipeline orchestration
  cli/
    index.mjs          CLI entry point (commander)
    commands/
      plan.mjs         intent plan
      init.mjs         intent init
      fix.mjs          intent fix
```
