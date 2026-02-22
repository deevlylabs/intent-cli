# INTENT AI Workflow Guide

Version 2.0 — AI-Oriented Usage  
Reference runtime: Node.js

---

## 1. Purpose

INTENT exists to enforce architectural boundaries in pull-request workflows — especially when code is generated or modified by AI agents.

AI agents tend to:

- Expand diffs across multiple domains.
- Introduce cross-domain edits unintentionally.
- Accumulate architectural drift over iterative pushes.
- Optimize locally while degrading global structure.

INTENT provides a deterministic enforcement loop:

- Stateless
- Git-diff based
- Machine-readable
- PR-time evaluation

In AI workflows, `intent.plan.json` is the source of truth — not the agent’s reasoning trace.

---

## 2. The Canonical AI Loop

This loop must be followed for any AI-generated PR.

### Iterative Governance Loop

1. AI edits files.
2. Run:

```bash
intent plan --json
```

3. Read `intent.plan.json`.
4. Branch on `.status`.

---

### If `status == "blocked"`

- Fix only the blocking violations.
- Do not introduce new features.
- Do not refactor unrelated code.
- Re-run `intent plan`.
- Repeat until not blocked.
- If still blocked after 2 iterations → escalate to human.

---

### If `status == "warn"`

- Prefer declaring explicit scope.
- Review whether scope inference is correct.
- Avoid expanding the diff further.
- It is mergeable, but should be reviewed.

---

### If `status == "pass"`

- No architectural violations.
- Safe to merge.

---

## 3. Deterministic Decision Model

Agents must use only the structured output.

Required fields:

- `.status`
- `.task.domain`
- `.task.source`
- `.violations[]`
- `.violations[].code`
- `.violations[].severity`
- `.violations[].confidence`
- `.violations[].evidence.path`
- `.violations[].bypassed`

Agents must not rely on terminal output formatting.

---

## 4. Required Behavior When Blocked

When INTENT returns `blocked`, the agent must:

- Minimize diff size.
- Eliminate violations with the smallest possible change.
- Preserve declared task scope.
- Avoid “helpful” refactors.

### Anti-pattern: AI Thrash

AI thrash occurs when:

- Each iteration adds new cross-domain changes.
- The number of violations increases.
- Scope changes mid-loop.

To prevent thrash:

- Max 2 remediation attempts per loop.
- Each iteration must reduce or eliminate violations.
- If violations increase → abort and escalate.

---

## 5. Handling Specific Violations

### UnknownDomainFile

Cause:
A changed file is not mapped in `system.intent`.

Resolution order:

1. Add path glob to correct existing domain.
2. Create new domain block.
3. Use `intent fix` and then refine.

Avoid:
Mapping everything to `Shared` for convenience.

---

### CrossDomainTouch

Cause:
`file.domain != task.domain`.

Resolution order:

1. Split PR into separate domain-scoped PRs.
2. Change declared scope if PR intent was incorrect.
3. Revert accidental cross-domain edits.
4. Apply policy tag if explicitly allowed.

Avoid:
Letting a single PR mutate multiple domains without declaration.

---

## 6. Scope Discipline for AI

AI-generated PRs should always include explicit scope.

Recommended PR body template:

```
INTENT-SCOPE: Identity
INTENT-TAGS: ai-generated
```

Benefits:

- Eliminates scope inference ambiguity.
- Reduces warnings.
- Makes loop stable.

If no scope is declared, INTENT may infer based on majority domain.
Inference is deterministic but may not reflect true intent.

---

## 7. Recommended CLI Usage for Agents

### Known target domain

```bash
intent plan --scope Identity --json
```

### Unknown target domain

```bash
intent plan --json
```

### Fix unmapped files

```bash
intent fix --dry-run
intent fix
```

Always prefer `--json` for machine workflows.

---

## 8. CI Integration Pattern

Minimal GitHub Actions step:

```yaml
- name: INTENT Plan
  run: intent plan --json --out intent.plan.json
```

The CI must fail on exit code 1.

Agents consuming CI artifacts should:

- Download `intent.plan.json`
- Parse `.status`
- Apply remediation if blocked

Do not parse terminal output.

---

## 9. Prompt Template for AI Agents

### Base Governance Prompt

Use this as a system or developer instruction:

```
You must obey INTENT governance.

Before finalizing any PR changes:
1) Run: intent plan --json [--scope <DOMAIN if known>]
2) Read intent.plan.json.
3) If status == "blocked":
   - Fix only blocking violations.
   - Do not refactor unrelated code.
   - Do not expand PR scope.
   - Re-run intent plan.
   - Repeat at most twice, then request human review.
4) If status == "warn":
   - Prefer declaring INTENT-SCOPE explicitly.
5) If status == "pass":
   - You may finalize.

Never bypass violations unless explicitly instructed.
Prefer smaller, single-domain PRs.
```

---

### Remediation Prompt

When blocked:

```
INTENT returned status=blocked.

Fix only the blocking violations listed in intent.plan.json.
Do not introduce new features.
Do not touch other domains.
After changes, re-run intent plan and confirm status != blocked.
```

---

## 10. Design Principles for AI-Compatible Governance

INTENT v2.0-core is:

- Stateless.
- Deterministic.
- Git-diff based.
- JSON-first.
- Domain-boundary oriented.

It does not:

- Infer intent from commit messages.
- Perform semantic code analysis.
- Enforce import graphs.
- Rewrite code automatically.

Its role in AI systems is narrow and explicit:

> Keep generated changes inside declared architectural boundaries.

---

## 11. Recommended Operational Limits

To maintain system stability in AI workflows:

- Maximum 2 automatic remediation loops.
- Maximum 1 domain per PR.
- No cross-domain edits without explicit declaration.
- No large refactors while blocked.

These limits reduce drift and review burden.

---

## 12. Final Principle

In AI-driven development:

- Agents optimize locally.
- INTENT enforces global structure.

The agent writes code.  
INTENT guards architecture.

Both are required for sustainable scale.