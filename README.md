# INTENT v2.0

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Spec: v2.0](https://img.shields.io/badge/Spec-v2.0-green.svg)](spec/INTENT-v2.0.md)

**INTENT is a typed DSL + governance runtime that enforces architectural intent for AI-built software.**
It turns PR diffs into typed actions, evaluates policies, and returns deterministic remediation for humans and agents.

## Why INTENT

AI agents are powerful, but without boundaries they:
- drift across domains,
- introduce hidden dependencies,
- and create ungoverned architectural entropy.

INTENT provides a formal, enforceable intent layer:
**Humans approve. Agents execute.**

## Core Principles

- **Humans approve, agents execute.** Humans write the minimum intent and approve plans/changes.
- **Stateless enforcement.** Every PR is evaluated from `*.intent + git diff (+ optional AST)` → decision.
- **No blocking on uncertainty.** If confidence is not high: warn + require approval, don't hard-block.
- **The runtime is the product.** The DSL is portable; enforcement + remediation + audit is the system.

## File Layers (3-Part Model)

1) `system.intent` — **Structural Map** (slow-moving)
   - domains, ownership, paths
   - public interfaces (`exposes`)
   - dependencies (`depends_on`)

2) `contracts/*.intent` — **Contracts** (versioned)
   - semantic types (`Email`, `Money`)
   - fields & operations
   - stability + version

3) `policies/*.intent` — **Policies** (swappable)
   - violations/rules
   - severity + confidence
   - approvals, exceptions/tags, autofix hints

## What v2.0 (MVP) Does

- Domain boundary enforcement (paths)
- Task scope enforcement (task domain vs. touched domains)
- Cross-domain import warnings (optional AST)
- Remediation as Code (JSON) for agents
- Escape hatches + approvals
- Modular spec (system / contracts / policy)

**Not yet:**
- Precise DBWrite/APICall extraction
- Full Terraform-like architecture reconciliation
- Polyglot deep enforcement

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

## RFC Process

> The `RFC/` directory does not exist yet. It will be created when the first RFC is submitted.

Propose changes via the RFC process:
1. Copy `RFC/INTENT-0000-template.md`
2. Fill in the template
3. Submit a PR titled `RFC: <title>`

## License

MIT — see [`LICENSE`](LICENSE).
