# Orchestration

1. Draft a local action proposal.
2. Run `action-approval-skill plan <proposal> --format markdown`.
3. Review side effects, sensitive fields, evidence, rollback, and warnings.
4. Ask for explicit human approval using the required phrase.
5. Pass the approved packet to a separate executor only after approval is recorded.

Do not connect this skill directly to live connector writes. It is a planning and approval artifact generator.
