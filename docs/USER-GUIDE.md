# INTENT User Guide

Version 2.0 — Reference runtime (Node.js)

---

## 1. What INTENT Does

INTENT evaluates pull request diffs against declared architectural rules.

It does four things:

1. **Maps files to domains.** Every source file belongs to a domain (e.g. Identity, Billing, Messaging). You declare these mappings in `system.intent`.

2. **Defines rules.** You write violation rules in `policies/*.intent`. Rules describe what is not allowed — for example, a file in the Billing domain being modified by a PR scoped to Identity.

3. **Evaluates diffs.** When you run `intent plan`, the tool reads the git diff, resolves which domain each changed file belongs to, checks every rule, and produces a list of violations.

4. **Blocks or passes.** If any violation has `severity error` and `confidence high`, the result is **blocked**. Otherwise it passes. The output is both a human-readable terminal report and a machine-readable `intent.plan.json`.

INTENT is stateless. It reads `.intent` files and a git diff. It makes no network calls. It writes no caches. Given the same inputs, it always produces the same output.

> **Still don't get it?** No worries — read **[INTENT for Humans](INTENT-FOR-HUMANS.md)**. It explains the whole thing without a single line of code.

---

## 2. 10-Minute Quickstart

### Install

```bash
npm install -g @intent/cli
```

Requires Node.js 18 or later.

### Initialize

Run this in the root of your repository:

```bash
intent init
```

This creates two files:

- **`system.intent`** — A structural map of your project. It scans your top-level directories and creates one domain per directory.
- **`policies/default.intent`** — A default policy with two rules: `CrossDomainTouch` and `UnknownDomainFile`.

You should edit `system.intent` afterward to match your real architecture. The generated version is a starting point.

### Evaluate

```bash
intent plan --scope Identity
```

This compares `HEAD~1` to `HEAD`, maps each changed file to a domain, evaluates the policy rules, and prints a report.

Example output:

```
▲ INTENT v2.0 • MyApp • scope: Identity (cli_override) • 4 files

  🚨 1 BLOCKING VIOLATION

  ✖ [CrossDomainTouch] src/billing/invoice.ts:12
    PR touches Billing but task is scoped to Identity: src/billing/invoice.ts
    → Split into separate PR, or tag intentional-cross-domain with approval.

────────────────────────────────────────────────────────────
  BLOCKED  1 error
────────────────────────────────────────────────────────────

  Next steps:
  → Fix 1 blocking violation to unblock merge
```

The tool also writes `intent.plan.json` to disk.

### Auto-fix

For `UnknownDomainFile` violations (files not mapped to any domain), you can run:

```bash
intent fix --scope Identity
```

This adds the missing path glob to `system.intent`. You should review the change before committing.

---

## Using INTENT with AI Agents

If you are using Cursor, Claude, Windsurf, Copilot or any AI coding agent — this is the workflow INTENT was built for.

AI agents generate code fast. They also break your architecture fast. A single agent-generated PR can touch 40 files across 5 domains, introduce cross-boundary dependencies, and accumulate tech debt that takes days to untangle. INTENT catches this in milliseconds, before the PR is merged.

The governance loop is simple:

1. The agent generates code and opens a PR.
2. `intent plan --json` evaluates the diff.
3. If blocked → the agent reads `intent.plan.json`, fixes only the violations, re-runs.
4. If pass → merge.

No manual review of domain boundaries. No silent architectural drift. The agent stays inside the lines.

For the full protocol — including prompt templates, remediation rules, anti-thrash limits, and CI integration patterns — see the dedicated guide:

**[`docs/AI-WORKFLOW.md`](AI-WORKFLOW.md)** — complete AI agent governance workflow.

---

## 3. Mental Model

INTENT runs a five-stage pipeline. Every stage is deterministic.

```
┌─────────────────┐
│  system.intent   │  Defines domains and their file paths.
└────────┬────────┘
         │
┌────────▼────────┐
│ policies/*.intent│  Defines violation rules.
└────────┬────────┘
         │
┌────────▼────────┐
│    git diff      │  Produces the Action Log: a list of
│                  │  ModifyFile actions with paths and hunks.
└────────┬────────┘
         │
┌────────▼────────┐
│   Task Scope     │  Determines which domain this PR
│                  │  is intended to work in.
└────────┬────────┘
         │
┌────────▼────────┐
│   Evaluation     │  For each action × each rule:
│                  │  does the rule's predicate match?
│                  │  If yes → violation.
└────────┬────────┘
         │
┌────────▼────────┐
│     Output       │  intent.plan.json + terminal report.
└─────────────────┘
```

### Stage 1: Load `system.intent`

This file declares domains and maps file paths to them using globs.

```
domain Identity {
  paths allow "src/identity/**"
}
```

Every file in `src/identity/` belongs to the Identity domain. If a file matches multiple domains, the most specific glob wins. If a file matches no domain, its domain is `null`.

### Stage 2: Load `policies/*.intent`

Policy files define violation rules. Each rule has a `when` predicate, a severity, and a confidence level. Rules are evaluated against every changed file.

### Stage 3: Build Action Log

INTENT runs `git diff` between two refs (by default `HEAD~1` and `HEAD`). It parses the diff into a list of `ModifyFile` actions. Each action has this shape:

```
ModifyFile {
  kind:       "ModifyFile"
  path:       string            POSIX-normalized file path
  fileDomain: string | null     resolved from domain map
  hunks:      Hunk[]            changed regions with line positions
}
```

The Action Log is the central abstraction: policies evaluate actions, not raw diffs. See `docs/AI-GUIDE.md` Section 4 for the full formal model.

### Stage 4: Resolve Task Scope

The task scope is the domain that this PR is *supposed* to modify. It can come from several sources (see Section 5). If the scope is Identity and a file in Billing is changed, that is a cross-domain touch.

### Stage 5: Evaluate

For each action in the log, for each rule in the policies, INTENT evaluates the `when` predicate. If it matches, a violation is created. Violations are sorted deterministically: by severity, then file path, then rule name.

The final status is:
- **pass** — no violations (or only info-level)
- **warn** — warnings exist, or task scope could not be determined
- **blocked** — at least one `severity error` + `confidence high` violation

---

## 4. Example Repository

Consider this project structure:

```
my-crm/
  system.intent
  policies/
    default.intent
  src/
    identity/
      auth.ts
      users.ts
    billing/
      invoice.ts
      payments.ts
    shared/
      logger.ts
      config.ts
```

### `system.intent`

```
intent 2.0

system MyCRM

import "policies/default.intent"

domain Identity {
  paths allow "src/identity/**"
}

domain Billing {
  paths allow "src/billing/**"
}

domain Shared {
  paths allow "src/shared/**"
}
```

Three domains. Each owns a directory.

### `policies/default.intent`

```
intent 2.0

policy Default {

  violation CrossDomainTouch confidence high {
    when action.kind == "ModifyFile" && file.domain != null && task.domain != null && file.domain != task.domain
    severity error
    message "PR touches {file.domain} but task is scoped to {task.domain}: {file.path}"
    suggest "Split into separate PR, or tag intentional-cross-domain with approval."
    except_when tagged "intentional-cross-domain" requires_approval "tech-lead"
  }

  violation UnknownDomainFile confidence high {
    when action.kind == "ModifyFile" && file.domain == null
    severity error
    message "File {file.path} is not mapped to any domain."
    suggest "Map this file to a domain in system.intent via paths allow."
  }
}
```

### Why CrossDomainTouch triggers

Suppose you run:

```bash
intent plan --scope Identity
```

And your PR modifies these files:

```
src/identity/auth.ts        → domain: Identity  ✔ matches scope
src/identity/users.ts       → domain: Identity  ✔ matches scope
src/billing/invoice.ts      → domain: Billing   ✖ does not match scope
```

The third file triggers `CrossDomainTouch`:

- `file.domain` is `Billing`
- `task.domain` is `Identity`
- `Billing != Identity` → predicate matches → violation emitted
- Severity is `error`, confidence is `high` → **status: blocked**

The fix is one of:

1. Remove `src/billing/invoice.ts` from this PR and put it in a separate Billing-scoped PR.
2. Add `INTENT-TAGS: intentional-cross-domain` to the PR body, and get tech-lead approval.

---

## 5. Task Scope

The task scope tells INTENT which domain this PR is meant to modify. INTENT resolves the scope from these sources, in priority order:

### 1. CLI `--scope` flag (highest priority)

```bash
intent plan --scope Billing
```

Source label: `cli_override`.

### 2. PR body header

Add this line anywhere in the PR description:

```
INTENT-SCOPE: Billing
```

Source label: `pr_header`.

### 3. Issue labels

If the PR or linked issue has a label matching `domain:<Name>`:

```
domain:Billing
```

Source label: `issue_label`.

### 4. Slash command in PR body

```
/intent scope Billing
```

Source label: `slash_command`.

### 5. Fallback inference (lowest priority)

If none of the above are present, INTENT counts which domain appears most among the changed files. The majority domain becomes the scope.

If there is a tie, the domain that comes first alphabetically wins. Alphabetical ordering uses ASCII string comparison of domain names (uppercase letters sort before lowercase).

Source label: `inferred`.

### When scope is unknown

If no source produces a scope, `task.domain` is `null` and `task.source` is `"unknown"`.

In this case:
- `CrossDomainTouch` does not trigger (the predicate checks `task.domain != null`).
- The overall status is downgraded from `pass` to `warn`, signaling that the PR should declare its scope.

### Tags

You can also set tags in the PR body:

```
INTENT-TAGS: intentional-cross-domain, experimental
```

Tags are used by `except_when tagged` clauses in policy rules. They enable exception/bypass flows.

---

## 6. Understanding Violations

### UnknownDomainFile

**What it means:** A changed file does not match any `paths allow` glob in `system.intent`.

**When it triggers:**
- You add a new file in a directory not covered by any domain.
- You have a file at the root level (e.g. `scripts/deploy.sh`) that no domain claims.

**How to fix it:**

Option A — Add the path to an existing domain:

```
domain Shared {
  paths allow "src/shared/**", "scripts/**"
}
```

Option B — Run `intent fix`:

```bash
intent fix --scope Identity
```

This adds a new domain block (named `Unmapped`) with a glob covering the file. You should rename the domain and adjust the glob.

Option C — Create a new domain for the directory.

### CrossDomainTouch

**What it means:** A changed file belongs to domain A, but the PR's task scope is domain B.

**When it triggers:**
- You are working on an Identity feature but also edited a Billing file.
- An AI agent generated a PR that touches files across multiple domains.

**How to fix it:**

Option A — Split the PR. Move the cross-domain changes into a separate PR scoped to the correct domain.

Option B — Declare the cross-domain intent by adding a tag to the PR body:

```
INTENT-TAGS: intentional-cross-domain
```

This triggers the `except_when tagged` clause. The violation is still emitted — bypass does not suppress it. The runtime resolves the effective severity to `warn` instead of the declared `error`, so it no longer blocks. The original rule declaration is not mutated; only the evaluation outcome changes. The `bypassed` field in `intent.plan.json` records the tag and approval requirement for auditability. It requires the approval role specified in the policy (e.g. `tech-lead`).

**When to split PRs:**

Split when:
- The cross-domain change is logically independent from the main change.
- The PR is already large.
- You want clean domain-scoped history.

Keep together when:
- The cross-domain change is a necessary side effect (e.g. updating a shared type).
- Tag it and get approval.

---

## 7. JSON Output

Every run of `intent plan` writes `intent.plan.json` to disk. You can also print it to stdout with `--json`.

### Example

```json
{
  "intent_version": "2.0",
  "status": "blocked",
  "task": {
    "domain": "Identity",
    "tags": [],
    "source": "cli_override"
  },
  "actions_summary": {
    "modify_files": 3,
    "import_cross_domain": 0
  },
  "violations": [
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
        "actions": [
          "Split into separate PR, or tag intentional-cross-domain with approval."
        ],
        "approved_interfaces": []
      },
      "bypassed": null
    }
  ]
}
```

### Field reference

**Top level:**

| Field | Type | Description |
|---|---|---|
| `intent_version` | string | Always `"2.0"` for this release. |
| `status` | string | `"pass"`, `"warn"`, or `"blocked"`. |
| `task.domain` | string or null | The resolved task scope domain. |
| `task.tags` | string[] | Tags from PR body (`INTENT-TAGS`). |
| `task.source` | string | How the scope was resolved. One of: `cli_override`, `pr_header`, `issue_label`, `slash_command`, `inferred`, `unknown`. |
| `actions_summary.modify_files` | number | Count of files changed. |

**Each violation:**

| Field | Type | Description |
|---|---|---|
| `code` | string | Rule name (e.g. `CrossDomainTouch`). |
| `severity` | string | Effective severity after confidence/bypass resolution: `"error"`, `"warn"`, or `"info"`. |
| `confidence` | string | Original confidence from the rule declaration: `"high"`, `"medium"`, or `"low"`. |
| `evidence.path` | string | File path that triggered the violation. |
| `evidence.file_domain` | string | Domain the file belongs to. |
| `evidence.task_domain` | string | Domain the task is scoped to. |
| `evidence.first_hunk_line` | number | First changed line (if available). |
| `remediation.actions` | string[] | Suggested fix actions. |
| `bypassed` | object or null | If non-null, the violation was bypassed via a tag. Contains `tag`, `approval_required`, and `approved`. |

### Severity resolution

The `severity` field in the JSON is the **effective** severity — it is resolved at evaluation time from the declared severity, the confidence level, and bypass status. The declared rule is not mutated.

| Declared severity | Confidence | Bypassed | Effective severity in JSON |
|---|---|---|---|
| error | high | no | `"error"` |
| error | high | yes | `"warn"` |
| error | medium | — | `"warn"` |
| error | low | — | `"info"` |
| warn | any | no | `"warn"` |
| warn | any | yes | `"warn"` |
| info | any | any | `"info"` |

### Status logic

The overall `status` is computed from the effective severities:

| Condition | Status |
|---|---|
| No violations | `pass` |
| Only `warn` or `info` effective severity | `warn` |
| Any effective `error` + `high` confidence, not bypassed | `blocked` |
| Task scope unknown, no other violations | `warn` |

### Consuming in CI

Read `intent.plan.json` after the plan step:

```yaml
- name: Check result
  run: |
    STATUS=$(jq -r .status intent.plan.json)
    if [ "$STATUS" = "blocked" ]; then
      echo "Blocked by INTENT"
      exit 1
    fi
```

Or rely on the exit code directly (see Section 8).

---

## 8. Exit Codes

| Code | Meaning |
|---|---|
| **0** | `pass` or `warn`. No blocking violations. Safe to merge. |
| **1** | `blocked`. At least one blocking violation. Merge should be rejected. |
| **2** | Engine error. Something went wrong before evaluation could run (missing `system.intent`, parse error, git error). |

In CI pipelines, check the exit code:

```yaml
- name: Evaluate
  run: intent plan --scope ${{ env.DOMAIN }}
  # Exit 0 → step passes
  # Exit 1 → step fails → PR check fails
```

For the `--json` flag:
- Exit **0**: stdout contains the plan JSON with `status: "pass"` or `status: "warn"`.
- Exit **1**: stdout contains the plan JSON with `status: "blocked"`.
- Exit **2**: stderr contains the error message. Stdout contains `{"error": "..."}`.

---

## Appendix: Command Reference

### `intent init`

```bash
intent init [--force]
```

Generates `system.intent` and `policies/default.intent` in the current repo. Skips existing files unless `--force` is passed.

### `intent plan`

```bash
intent plan [options]
```

| Flag | Default | Description |
|---|---|---|
| `--scope <domain>` | (inferred) | Set the task domain. |
| `--base <ref>` | `HEAD~1` | Git diff base reference. |
| `--head <ref>` | `HEAD` | Git diff head reference. |
| `--json` | off | Print JSON to stdout instead of the formatted report. |
| `--out <path>` | `intent.plan.json` | Output path for the JSON file. |
| `--cwd <path>` | (auto) | Override the repository root. |

### `intent fix`

```bash
intent fix [options]
```

| Flag | Default | Description |
|---|---|---|
| `--scope <domain>` | (inferred) | Set the task domain. |
| `--base <ref>` | `HEAD~1` | Git diff base reference. |
| `--head <ref>` | `HEAD` | Git diff head reference. |
| `--dry-run` | off | Show what would be fixed without writing files. |

Currently fixes `UnknownDomainFile` only, by adding path globs to `system.intent`.

### Global flags

| Flag | Description |
|---|---|
| `--cwd <path>` | Override repository root detection. |
| `--no-color` | Disable colored output. |
| `--version` | Print version and exit. |
| `--help` | Print help and exit. |
