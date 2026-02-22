<p align="center">
  <img src="public/images/logo_text.png" alt="INTENT" width="480">
</p>

<p align="center">
  <strong>Architectural governance for modern codebases.</strong><br>
  A declarative DSL for modeling architectural domains and policies.<br>
  Deterministic. Stateless. PR-time enforcement.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Version-2.0.0-green.svg" alt="Version 2.0.0"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg" alt="Node >= 18"></a>
</p>

---

## The problem

AI agents write code faster than any human. They also break your architecture faster than any human.

A single agent-generated PR can touch 40 files across 5 domains. It imports directly from modules it shouldn't know about. It updates database tables owned by another team. It does all of this while producing code that *works* — and that's what makes it dangerous.

By the time you notice, the damage is spread across dozens of merged PRs. Refactoring costs weeks. The architecture diagram no longer matches reality.

## The solution

**INTENT** is a lightweight DSL and CLI that enforces architectural domain boundaries on every pull request.

You declare your rules once:

```
domain Identity {
  paths allow "src/auth/**", "lib/auth/**"
}

domain Billing {
  paths allow "src/billing/**"
}
```

Every diff is evaluated automatically. Cross-domain violations are blocked before merge — with clear messages and fix suggestions.

```
▲ INTENT v2.0 • MyApp • scope: Identity (cli_override) • 4 files

  🚨 1 BLOCKING VIOLATION

  ✖ [CrossDomainTouch] src/billing/invoice.ts:28
    PR touches Billing but task is scoped to Identity: src/billing/invoice.ts
    → Split into separate PR, or tag intentional-cross-domain with approval.

────────────────────────────────────────────────────────────
  BLOCKED  1 error
────────────────────────────────────────────────────────────
```

The agent gets the feedback. It fixes the violation. You just approve.

---

## Get started in 60 seconds

```bash
npm install -g github:deevlylabs/intent-cli

intent init        # generates system.intent + policies/
intent plan        # evaluates your current diff
```

> **Note:** INTENT is not yet published on npm. Install directly from GitHub as shown above. This will be migrated to `@intent/cli` on npm soon.

That's it. Edit `system.intent` to match your real architecture, and INTENT is enforcing from the first PR.

---

## Why INTENT

| Without INTENT | With INTENT |
|---|---|
| Architecture enforced socially (reviews, conventions) | Architecture enforced deterministically (DSL + CLI) |
| Manual review for domain boundary compliance | Automated evaluation on every PR |
| Implicit domain boundaries, undocumented | Explicit domain declarations, version-controlled |
| Drift accumulates silently across merged PRs | Violations blocked before merge |

---

## Built for AI workflows

INTENT works for any team, but it shines when AI agents are generating code. Agents optimize locally and break boundaries silently — INTENT catches it before merge.

The governance loop is automatic:

1. Agent generates code → opens PR
2. `intent plan --json` evaluates the diff
3. Blocked? → agent reads `intent.plan.json`, fixes violations, re-runs
4. Pass? → merge

No manual architectural policing required. The agent stays inside the lines.

**[Read the full AI workflow guide →](docs/AI-WORKFLOW.md)**

---

## How it works

INTENT evaluates diffs through a deterministic pipeline:

1. **Load** `system.intent` (domains + paths) and `policies/*.intent` (rules)
2. **Diff** — extract changed files from `git diff`
3. **Map** — resolve each file to its owning domain
4. **Evaluate** — check every rule against every changed file
5. **Report** — emit `intent.plan.json` + human-readable report

No network calls. No AI in the evaluator. No hidden state. Same inputs → same output, every time.

---

## Who is this for

- **AI-heavy teams** shipping fast with Cursor, Claude, Copilot or agent swarms — who need their codebase to stay clean without slowing down.
- **Growing engineering orgs (5–50+)** where implicit conventions no longer scale and domain boundaries need to be enforced, not just documented.
- **Regulated environments** (fintech, healthtech, B2B SaaS) that need auditable, deterministic proof that architectural boundaries are respected.

---

## Documentation

| Document | Description |
|---|---|
| **[INTENT for Humans](docs/INTENT-FOR-HUMANS.md)** | Still don't get it? Read this. Zero jargon, pure clarity. |
| **[User Guide](docs/USER-GUIDE.md)** | Complete guide: quickstart, mental model, violations, JSON output, exit codes |
| **[AI Workflow Guide](docs/AI-WORKFLOW.md)** | Governance loop for AI agents, prompt templates, anti-thrash rules |
| **[Formal Model](docs/AI-GUIDE.md)** | Language grammar, execution model, evaluation semantics, determinism guarantees |

### Specifications

| Spec | Path |
|---|---|
| Core specification | [`spec/INTENT-v2.0.md`](spec/INTENT-v2.0.md) |
| Output schema | [`spec/PLAN-JSON.md`](spec/PLAN-JSON.md) |
| Action model | [`spec/ACTION-LOG.md`](spec/ACTION-LOG.md) |
| Compliance levels | [`spec/COMPLIANCE-LEVELS.md`](spec/COMPLIANCE-LEVELS.md) |

### Examples

| Example | Path |
|---|---|
| Structural map | [`examples/system.intent`](examples/system.intent) |
| Policy rules | [`examples/policies/default.intent`](examples/policies/default.intent) |

---

## CLI at a glance

```bash
intent init                  # scaffold system.intent + policies/
intent plan --scope Billing  # evaluate diff against rules
intent fix --dry-run         # preview auto-fixes
intent plan --json           # machine-readable output for CI/agents
```

| Exit code | Meaning |
|---|---|
| `0` | Pass or warn — safe to merge |
| `1` | Blocked — violations must be fixed |
| `2` | Engine error |

---

## License

MIT — see [`LICENSE`](LICENSE).

Copyright (c) 2026 [DeevlyLabs](https://github.com/DeevlyLabs)

<p align="center"><sub>Created for the age of AI — with ❤️</sub></p>
