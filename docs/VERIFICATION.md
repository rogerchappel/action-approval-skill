# Verification Report

Commands run successfully on 2026-06-30:

- npm test
- npm run check
- npm run build
- npm run smoke
- npm run package:smoke
- npm run release:check
- bash scripts/validate.sh

Smoke output confirmed Markdown approval packet generation for fixtures/slack-message.json with high-risk classification, side effects, sensitive fields, evidence, rollback, checklist, approval phrase, and warning sections.

`release:check` is the broadest maintained gate. It runs type checking,
fixture-backed tests, approval-packet smoke coverage, and package contents
verification.
