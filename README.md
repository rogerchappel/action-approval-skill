# action-approval-skill

Local-first approval packet generator for agent actions that could affect external systems. It turns a JSON or Markdown proposal into a dry-run packet with risk, side effects, sensitive fields, evidence, rollback notes, and an explicit approval phrase.

## Quickstart

```bash
npm install
npm run build
node dist/cli.js --help
node dist/cli.js --version
node dist/cli.js plan fixtures/slack-message.json --format markdown
node dist/cli.js plan fixtures/repository-push.json --format json
```

## CLI

- `action-approval-skill plan <proposal> [--format markdown|json]` creates an approval packet.
- `action-approval-skill check <packet.md>` verifies that a packet has the required approval sections.

`--format` is available only for `plan`, must be followed by `markdown` or
`json`, and defaults to `markdown`. Unknown options and additional positional
arguments are rejected. File and proposal errors are printed as concise
diagnostics to standard error, with no partial packet output.

JSON proposals must be objects. Text fields such as `action` and `rollback`
must be strings; `sideEffects`, `sensitiveFields`, and `evidence` must be
arrays of strings. Every JSON or Markdown proposal must provide a non-empty
`action` or `summary`; other fields are optional. Markdown fields use
`Field: value` lines, and prose without a recognized actionable field is
rejected. Invalid or incomplete proposals exit nonzero and do not emit a packet.
Packet checks require the expected standalone Markdown headings, so heading
names mentioned inside prose or list items do not satisfy the check.

## Library

```js
import { createApprovalPacket, packetToMarkdown } from 'action-approval-skill';
const packet = createApprovalPacket({ action: 'create GitHub issue', evidence: ['npm test'] });
console.log(packetToMarkdown(packet));
```

## Safety Notes

This package never performs external actions, stores credentials, or calls live APIs. Treat generated packets as approval evidence for a separate executor, not as approval by themselves. Credentials, customer details, contact data, and private repository information should be redacted before sharing packets outside the trusted workspace.


## Limitations

V1 uses deterministic keyword classification. It is intended for structured proposals and fixture-backed dry runs, not full policy enforcement or legal approval.

## Verification

Run the release gate before publishing or opening a release PR:

```bash
npm run release:check
```

The gate type-checks the TypeScript sources, runs fixture-backed tests, exercises the CLI smoke path, and verifies the npm tarball includes the CLI, library output, skill file, fixtures, docs, license, changelog, and security policy.

`npm run release:readiness` verifies package metadata, the CLI bin target,
package export, support docs, release fixtures, CI presence, and the npm files
allowlist before runtime checks begin.

Use the individual verification commands when narrowing a release-gate failure:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
```

`package:smoke` builds the CLI, verifies the published bin target, support docs,
skill file, fixtures, and package allowlist, then runs `npm pack --dry-run`.

## Release notes

Before tagging a release, confirm the smoke fixture still represents the intended workflow and summarize any changed output, limitations, or operator steps in the PR.
