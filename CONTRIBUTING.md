# Contributing

INTENT is evolving. Contributions are welcome.

## How to Contribute

- Open an issue for bugs, questions, or proposals.
- For language changes, use the RFC process:
  1. Copy `RFC/INTENT-0000-template.md` (the `RFC/` directory will be created with the first submission)
  2. Fill in the template
  3. Submit a PR titled `RFC: <title>`

## Style / Philosophy

- Prefer minimal core semantics.
- Avoid features that increase false positives.
- If enforcement is uncertain, downgrade to warn + approval.

## Spec Changes

If you modify [`spec/INTENT-v2.0.md`](spec/INTENT-v2.0.md), also update:
- [`spec/COMPLIANCE-LEVELS.md`](spec/COMPLIANCE-LEVELS.md) (if needed)
- Examples under [`examples/`](examples/) (if behavior changes)

## Code of Conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).