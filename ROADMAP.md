# Roadmap

## v2.0-core (MVP)
- Domains + path mapping
- Task scope resolution (PR header / issue labels / slash command)
- ModifyFile action extraction (diff-based)
- Policy evaluation (severity + confidence + approvals + exceptions)
- intent.plan.json output

## v2.0-ast
- ImportCrossDomain action via AST (Tree-sitter)
- Confidence grading for AST signals
- Better remediation suggestions (public contract recommendations)

## v2.1+
- intent scan bootstrap from existing repos
- Policy transpilation strategy (Semgrep/OPA) documented

## v3.x (future)
- Typed DBWrite/APICall (deeper analysis)
- Drift detection beyond file paths (import graphs, dependency graphs)
- “Intent reconciliation” reports over time