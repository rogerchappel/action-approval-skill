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

## Examples

```bash
action-approval-skill plan fixtures/crm-update.json --format markdown
action-approval-skill check approval-packet.md
```

`check` accepts one coherent generated packet: the packet title must be first,
required sections must be unique and in generated order, and their bodies must
contain content other than Markdown whitespace or HTML comments. Invalid
packets produce JSON diagnostics and a nonzero status.

## Validation

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, and `npm run package:smoke`. Confirm the packet names side effects, evidence, rollback, warnings, and the approval phrase.
