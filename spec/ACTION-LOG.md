# Action Log v2.0 (MVP)

INTENT evaluates policies over a typed Action Log produced from PR diffs and optional AST analysis.

## Actions

### ModifyFile (MUST)
Produced from git diff.
Fields:
- `kind`: "ModifyFile"
- `path`: string
- `fileDomain`: string | null
- `hunks`: number[] (optional)

### ImportCrossDomain (SHOULD)
Produced from AST parsing (Tree-sitter).
Fields:
- `kind`: "ImportCrossDomain"
- `sourcePath`: string
- `sourceDomain`: string | null
- `targetImport`: string
- `targetDomain`: string | null
- `confidence`: "high" | "medium"

## Notes
- v2.0 enforces deterministic, low-false-positive rules first (file boundaries).
- AST-based signals should carry confidence and default to warn/approval.