# INTENT Compliance Levels

## v2.0-core
Required:
- `system.intent` with domains + paths
- Task scope resolution (header / label / slash command / inferred)
- `ModifyFile` action extraction
- Policy evaluation with severity + confidence
- `intent.plan.json` output

## v2.0-ast
Adds:
- `ImportCrossDomain` via AST (Tree-sitter)
- Confidence grading
- Remediation hints referencing contracts

## v2.1+
Adds:
- `intent scan` bootstrap
- Better overlap resolution + suggestions
