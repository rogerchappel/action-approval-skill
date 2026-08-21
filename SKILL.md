# action-approval-skill

Use this skill when an agent proposes an external side effect such as sending a message, updating a CRM, creating a ticket, or pushing repository changes. The skill converts the proposed action into a local dry-run approval packet.

## Inputs

- JSON object or `Field: value` Markdown proposal with a non-empty action or summary. System, side effects, sensitive fields, evidence, rollback, and approval phrase are optional.
- Unstructured prose and proposals containing only optional fields are invalid and must not produce a packet.
- Local files only. Do not fetch credentials or call external APIs.

## Side-Effect Boundary

The skill is dry-run only. It must not send messages, update remote records, create issues, push code, or approve its own packet.

## Approval Requirements

Require explicit human approval before any downstream executor acts. High-risk packets include sensitive fields, public communication, repository pushes, deletes, charges, or customer-impacting updates.

When classification fields are omitted, deterministic inference considers only
the proposal's action, summary, system, actor, and target. It matches action
keywords as complete words or phrases; titles, evidence, rollback notes, and
approval phrases are descriptive context and do not create inferred side
effects or sensitive fields. Explicit `sideEffects` and `sensitiveFields`,
including empty arrays, are authoritative.

## Examples

```bash
action-approval-skill plan fixtures/crm-update.json --format markdown
action-approval-skill check approval-packet.md
```

`check` accepts one coherent generated packet: the packet title must be first,
required sections must be unique and in generated order, and their bodies must
contain semantic text rather than only Markdown whitespace, HTML comments, or
bare list, task-list, quote, fence, or thematic-break markers. Invalid
packets produce JSON diagnostics and a nonzero status. Headings and content
inside backtick or tilde fenced code blocks are examples, not packet structure.

## Validation

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, and `npm run package:smoke`. Confirm the packet names side effects, evidence, rollback, warnings, and the approval phrase.
