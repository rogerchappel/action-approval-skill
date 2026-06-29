# PRD: action-approval-skill

Status: in-progress
Decision: build next
Created: 2026-06-29

## Pitch

`action-approval-skill` gives agents a local, structured way to draft approval requests for external side effects such as sending messages, updating CRMs, opening tickets, or pushing repository changes.

## Why It Matters

Connector and action workflows are safest when agents separate planning from execution. A reusable skill can convert a proposed action into a dry-run plan, risk summary, approval checklist, and audit-friendly receipt without touching external accounts.

## V1 Scope

- TypeScript CLI and library API.
- Accept JSON or Markdown action proposals.
- Classify side effects, required approvals, target systems, sensitive fields, rollback notes, and evidence links.
- Emit Markdown approval packets and machine-readable JSON.
- Support `action-approval-skill plan <proposal>` and `action-approval-skill check <packet>`.
- Include fixtures for Slack/message send, CRM update, GitHub issue creation, and repository push plans.
- Include `SKILL.md`, docs/PRD.md, docs/TASKS.md, docs/ORCHESTRATION.md, smoke command, tests, and release-candidate notes.

## Out of Scope

- Performing the external action.
- Storing credentials.
- Making live API calls.
- Replacing human approval.

## Safety

- Dry-run only in V1.
- Treat credentials, customer data, and private contact details as sensitive by default.
- Require explicit approval language before any downstream executor uses the packet.

## Verification

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, `npm run package:smoke`, and fixture-based CLI checks for all proposal types.
