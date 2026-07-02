# action-approval-skill

Local-first approval packet generator for agent actions that could affect external systems. It turns a JSON or Markdown proposal into a dry-run packet with risk, side effects, sensitive fields, evidence, rollback notes, and an explicit approval phrase.

## Quickstart

```bash
npm install
npm run build
node dist/cli.js plan fixtures/slack-message.json --format markdown
node dist/cli.js plan fixtures/repository-push.json --format json
```

## CLI

- `action-approval-skill plan <proposal> [--format markdown|json]` creates an approval packet.
- `action-approval-skill check <packet.md>` verifies that a packet has the required approval sections.

## Library

```js
import { createApprovalPacket, packetToMarkdown } from 'action-approval-skill';
const packet = createApprovalPacket({ action: 'create GitHub issue', evidence: ['npm test'] });
console.log(packetToMarkdown(packet));
```

## Verification

Run the release gate before publishing or opening a release PR:

```bash
npm run release:check
```

The gate type-checks the TypeScript sources, runs fixture-backed tests, exercises the CLI smoke path, and verifies the npm tarball includes the CLI, library output, skill file, fixtures, docs, license, changelog, and security policy.

## Safety Notes

This package never performs external actions, stores credentials, or calls live APIs. Treat generated packets as approval evidence for a separate executor, not as approval by themselves. Credentials, customer details, contact data, and private repository information should be redacted before sharing packets outside the trusted workspace.

## Limitations

V1 uses deterministic keyword classification. It is intended for structured proposals and fixture-backed dry runs, not full policy enforcement or legal approval.

Use the individual verification commands when narrowing a release-gate failure:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
```

`package:smoke` builds the CLI, verifies the published bin target, support docs,
skill file, fixtures, and package allowlist, then runs `npm pack --dry-run`.
