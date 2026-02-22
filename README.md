# INTENT

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Spec: v2.0](https://img.shields.io/badge/Spec-v2.0-green.svg)](spec/INTENT-v2.0.md)

**The fence your AI agents can't jump.**

Cursor, Claude, Windsurf and agent swarms generate code at full speed…
but they also destroy your architecture in silence.

INTENT is the governance system that prevents that.

You declare your domains, public contracts and rules **once**.
Every PR is evaluated automatically.
Violations are blocked or corrected with actionable suggestions.

**Humans approve the intent. Agents execute within the lines.**

---

## The Problem You See Every Day

Day 12 of the MVP. You ask the agent:

> "When a new email arrives, generate a follow-up draft and save it."

The agent opens a PR with 47 files. Among them, it does this:

```ts
// app/messaging/new-email-handler.ts
const user = await prisma.user.findUnique({ ... });           // ← violates Identity domain
await prisma.user.update({ lastContactedAt: new Date() });   // ← crosses domain boundary
```

- **Without INTENT:** you spend 2 hours reviewing manually or accept the tech debt.
- **With INTENT:** the PR is blocked in 400 ms with a clear message and a fix suggestion.

---

## What It Looks Like in Practice

```bash
$ intent plan --pr 142
```

Actual output:

```
INTENT v2.0 • PR #142 • Acme AI CRM

🚨 2 BLOCKING VIOLATIONS

[ERROR] CrossDomainDirectAccess
  File: app/messaging/new-email-handler.ts:28
  Action: DBWrite → Database.Users
  Actor domain: Messaging
  Message: Messaging cannot directly touch the Users table owned by Identity
  Suggestion: Use Identity.User.Public.updateLastContacted(userId)
  → intent fix --pr 142 --violation 1  (auto-fix available)

[WARN] UndeclaredPath
  File: lib/utils/email-utils.ts (new)
  → Add to paths allow in the Messaging domain

Summary: 2 errors, 1 warning → Merge blocked
Granularity: too large for a single task
```

The agent receives the feedback and regenerates correctly. You just approve.

---

## What INTENT Gives You

- ✅ Automatic domain ownership by paths
- ✅ Public contracts (what other domains are allowed to touch)
- ✅ Violations with clear messages + suggestions + auto-fix
- ✅ Fitness functions (latency, LLM cost, etc.)
- ✅ GitHub App that runs `intent plan` on every PR
- ✅ Full traceability for audits and compliance
- ✅ Your agents get better instead of worse

---

## Install in 60 Seconds

```bash
npm install -g @intent/cli
intent init          # scans your repo and generates 70% of the spec automatically
intent plan --pr 142 # try it on any PR
```

Then add the GitHub App and you're done.

---

## Who Is This For?

- **Founders** who use agents every day and don't want their codebase to become spaghetti in 3 months.
- **Teams of 5–50 engineers** already carrying tech debt from AI-generated PRs.
- **Regulated companies** (fintech, healthtech, B2B SaaS) that need real traceability.

---

## Current Status (February 2026)

**v2.0 MVP — usable now:**

- Domain + path enforcement
- Public contracts
- Actionable violations
- `intent plan` + GitHub check

**Coming next:** full AST, fitness functions in CI, visual graph.

---

## Specs

| Document | Path |
|---|---|
| Core specification | [`spec/INTENT-v2.0.md`](spec/INTENT-v2.0.md) |
| Output schema | [`spec/PLAN-JSON.md`](spec/PLAN-JSON.md) |
| Action model | [`spec/ACTION-LOG.md`](spec/ACTION-LOG.md) |
| Compliance levels | [`spec/COMPLIANCE-LEVELS.md`](spec/COMPLIANCE-LEVELS.md) |

## Examples

See [`examples/`](examples/) for annotated samples:
- [`examples/system.intent`](examples/system.intent) — structural map
- [`examples/contracts/core.intent`](examples/contracts/core.intent) — contract definitions
- [`examples/policies/default.intent`](examples/policies/default.intent) — policy rules

---

## License

MIT — see [`LICENSE`](LICENSE).

Built with ❤️ for the agentic era.
