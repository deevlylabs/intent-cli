# Roadmap

This roadmap separates language evolution, runtime capabilities, and analysis depth.
Each version defines a clear enforcement level and deterministic guarantees.

---

# v2.0-core (Released — Reference Runtime)

**Objective:**  
Deterministic, diff-based architectural boundary enforcement at file level.

This version establishes INTENT as:

- Stateless
- Deterministic
- Git-diff driven
- JSON-first
- PR-time enforced

---

## Language (DSL)

### `system.intent`

Supported constructs:

- `intent 2.0`
- `system <Name>`
- `import "<path>"`
- `domain <Name> { ... }`
- `paths allow "<glob>"`

Resolution rules:

- Most specific glob wins.
- If no match → `file.domain = null`.
- Tie-breaking is deterministic.

---

### `policies/*.intent`

Supported constructs:

- `policy <Name> { ... }`
- `violation <Name> confidence <level> { ... }`
- `when <predicate>`
- `severity error|warn|info`
- `message`
- `suggest`
- `except_when tagged "<tag>" requires_approval "<role>"`

Supported predicate signals:

- `action.kind`
- `file.domain`
- `file.path`
- `task.domain`
- `task.tags`

---

## Runtime

### Task Scope Resolution

Priority order:

1. CLI `--scope`
2. PR header (`INTENT-SCOPE`)
3. Issue labels (`domain:<Name>`)
4. Slash command (`/intent scope`)
5. Fallback inference (majority domain)

Deterministic tie-breaking:
- Alphabetical ASCII comparison.

---

### Action Extraction

- `git diff` based
- `ModifyFile` actions only
- Hunk extraction:
  - Path
  - Domain
  - First changed line
  - Additions / deletions

---

### Evaluation Engine

For each:

```
action × rule
```

Evaluate predicate → emit violation if true.

Deterministic sorting:

1. Severity
2. File path
3. Rule name

---

### Status Logic

- `pass`
- `warn`
- `blocked`

Blocking condition:

```
severity == error
AND confidence == high
AND not bypassed
```

Confidence downgrade:

- error + medium → warn
- error + low → info

---

### Output

Stable schema:

- `intent.plan.json`
- Deterministic
- No hidden state
- No external calls

---

## Definition of Done (v2.0-core)

- CLI (`init`, `plan`, `fix`) stable
- Exit codes enforced
- JSON schema frozen
- 100% deterministic evaluation
- CI-ready
- AI-loop compatible

---

# v2.0-ast (Next Phase)

**Objective:**  
Extend enforcement from file-level boundaries to import-level boundaries using AST.

This phase introduces structural awareness without semantic deep typing.

---

## New Action Types

- `ImportCrossDomain`

Generated via AST parsing (Tree-sitter).

Signals:

- Import path
- Source file domain
- Target file domain

---

## Runtime Additions

- AST parsing per changed file
- Language support (initially JS/TS)
- Confidence grading for AST-derived signals

Confidence model:

- High → static import literal
- Medium → dynamic import
- Low → heuristic match

---

## Evaluation Extension

Rules can reference:

- `import.source.domain`
- `import.target.domain`

Example:

```
when action.kind == "ImportCrossDomain"
&& import.source.domain != import.target.domain
```

---

## Remediation Improvements

- Suggest allowed public contracts (if declared)
- Suggest dependency direction correction

---

## Definition of Done (v2.0-ast)

- Deterministic AST extraction
- No false positives from parser instability
- Language isolation (fail safely if parser unsupported)
- Confidence documented and predictable

---

# v2.1 (Contracts Model — Structural Typing Layer)

**Objective:**  
Introduce architectural contracts as a typed interface layer (model-only, not full enforcement yet).

---

## DSL Additions

In `contracts/*.intent`:

- `type`
- `contract`
- `expose Public|Internal`
- `method` definitions

---

## Runtime Additions

- Contract graph:
  - Domain → Contracts → Methods
- Validation:
  - Duplicate definitions
  - Invalid references
  - Ownership consistency

No full enforcement yet.

Used for:

- Structured remediation suggestions
- Public surface modeling
- Future dependency typing

---

## Definition of Done (v2.1)

- Contracts parsed into AST
- Contract graph built deterministically
- Referenced in plan JSON (read-only model)
- No breaking change to v2.0 enforcement

---

# v3.0 (Architectural Type System)

**Objective:**  
Move from boundary linting to typed dependency enforcement.

---

## Dependency Typing

Enforce:

- Cross-domain interaction only via declared public contracts.
- No direct file-level access across domains.

Requires:

- Import graph analysis
- Call-site resolution
- Contract method matching

---

## New Enforcement Model

Violation triggers if:

```
import.source.domain != import.target.domain
AND no matching public contract allows interaction
```

---

## Typed Actions (Planned)

- `DBWrite`
- `APICall`
- `ExternalDependencyUse`

Each typed and bound to domain ownership.

---

## Determinism Requirements

- No probabilistic analysis
- No heuristic-only enforcement
- Language-specific adapters must produce stable outputs

---

# v3.x (Deep Governance)

**Objective:**  
Detect architectural drift over time and enforce systemic integrity.

---

## Drift Detection

- Domain graph evolution
- Cross-domain dependency growth
- Contract surface expansion

Generate:

- Drift reports
- Boundary erosion metrics
- Domain entropy scoring

---

## Intent Reconciliation

Compare:

- Declared architecture
- Observed import graph
- Observed runtime usage

Detect mismatch trends.

---

## Multi-language Support

Adapters:

- TypeScript / JavaScript
- Go
- Java
- Python

Unified action model.

---

# Long-Term Vision

INTENT evolves from:

File-boundary linter  
→ Structural boundary enforcer  
→ Typed architectural system  
→ Continuous architectural governance layer  

At every stage:

- Stateless
- Deterministic
- PR-time enforceable
- Machine-readable
- AI-loop compatible