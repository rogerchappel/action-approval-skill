import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApprovalPacket, parseProposal, packetToMarkdown, checkPacketText } from '../dist/index.js';

test('classifies side-effect proposals as approval required', () => { const packet = createApprovalPacket({ action: 'send Slack message', sideEffects: ['external message'], sensitiveFields: ['email'] }); assert.equal(packet.requiresApproval, true); assert.equal(packet.risk, 'high'); });
test('infers external writes that require approval', () => {
  const cases = [
    ['update CRM record', 'record update'],
    ['create a ticket', 'ticket creation'],
  ];

  for (const [action, sideEffect] of cases) {
    const packet = createApprovalPacket({ action });
    assert.equal(packet.requiresApproval, true);
    assert.notEqual(packet.risk, 'low');
    assert.deepEqual(packet.sideEffects, [sideEffect]);
  }
});
test('classifies only semantically relevant proposal fields and complete action words', () => {
  const documentation = createApprovalPacket({
    title: 'Email postmortem for customer-impacting incident',
    action: 'document the release notes',
    evidence: ['postmortem.md', 'secret-scan.txt'],
    rollback: 'revert the documentation push',
  });

  assert.deepEqual(documentation.sideEffects, []);
  assert.deepEqual(documentation.sensitiveFields, []);
  assert.equal(documentation.risk, 'low');
  assert.equal(documentation.requiresApproval, false);

  for (const keyword of ['send', 'post', 'push', 'delete', 'invite', 'charge', 'email', 'message']) {
    const packet = createApprovalPacket({ action: `${keyword} the requested update` });
    assert.deepEqual(packet.sideEffects, [keyword === 'push' ? 'repository push' : keyword]);
    assert.equal(packet.requiresApproval, true);
    assert.equal(packet.risk, 'high');
  }

  const substrings = createApprovalPacket({ action: 'document poster postage and messages' });
  assert.deepEqual(substrings.sideEffects, []);
  assert.equal(substrings.requiresApproval, false);
});
test('preserves explicitly supplied classification fields, including empty arrays', () => {
  const packet = createApprovalPacket({
    action: 'send a customer email',
    sideEffects: [],
    sensitiveFields: [],
  });

  assert.deepEqual(packet.sideEffects, []);
  assert.deepEqual(packet.sensitiveFields, []);
  assert.equal(packet.risk, 'low');
});
test('normalizes blank and mixed string-array entries before classification', () => {
  const blank = createApprovalPacket({
    action: 'document the release',
    sideEffects: [' ', '\t'],
    sensitiveFields: ['\n'],
    evidence: ['   '],
    rollback: '  ',
  });

  assert.deepEqual(blank.sideEffects, []);
  assert.deepEqual(blank.sensitiveFields, []);
  assert.deepEqual(blank.evidence, []);
  assert.equal(blank.risk, 'low');
  assert.equal(blank.requiresApproval, false);
  assert.equal(blank.rollback, 'Not provided');
  assert.deepEqual(blank.warnings, ['Rollback notes missing.', 'Evidence links missing.']);

  const mixed = createApprovalPacket({
    action: 'document the release',
    sideEffects: [' ', ' external notification ', '\t'],
    sensitiveFields: [' ', ' customer email '],
    evidence: [' ', ' npm test ', '\n'],
    rollback: ' revert the commit ',
  });
  assert.deepEqual(mixed.sideEffects, ['external notification']);
  assert.deepEqual(mixed.sensitiveFields, ['customer email']);
  assert.deepEqual(mixed.evidence, ['npm test']);
  assert.equal(mixed.rollback, 'revert the commit');
  assert.equal(mixed.risk, 'high');
  assert.deepEqual(mixed.warnings, ['Sensitive data detected; redact before sharing broadly.']);
});
test('uses meaningful scalar fallbacks when optional values are blank', () => {
  const packet = createApprovalPacket({
    action: '   ',
    summary: 'send a message to the launch channel',
    title: ' ',
    system: '\t',
    rollback: '\n',
    approval: '  ',
  });

  assert.equal(packet.action, 'send a message to the launch channel');
  assert.equal(packet.title, 'send a message to the launch channel');
  assert.equal(packet.system, 'external system');
  assert.deepEqual(packet.sideEffects, ['send', 'message']);
  assert.equal(packet.risk, 'high');
  assert.equal(packet.requiresApproval, true);
  assert.equal(packet.rollback, 'Not provided');
  assert.equal(packet.approvalPhrase, 'APPROVE ACTION');
});
test('parses markdown proposal fields', () => { const parsed = parseProposal('Title: Demo\nAction: create GitHub issue\nEvidence: log.txt'); assert.equal(parsed.title, 'Demo'); assert.deepEqual(parsed.evidence, ['log.txt']); });
test('preserves and normalizes Actor consistently across Markdown and JSON proposals', () => {
  const markdown = parseProposal('Action: review item\n- Actor:   GitHub App   ');
  const json = parseProposal('{"action":"review item","actor":"GitHub App"}');

  assert.equal(markdown.actor, 'GitHub App');
  assert.equal(markdown.actor, json.actor);
  assert.equal(createApprovalPacket(markdown).system, 'github');
  assert.equal(createApprovalPacket(json).system, 'github');
});
test('requires a non-empty action or summary in proposals', () => {
  for (const proposal of [
    'this is not a structured proposal',
    'Title: Notes only\nEvidence: log.txt',
    'Action:   ',
    '{}',
    '{"title":"Notes only"}',
    '{"action":"   "}',
  ]) {
    assert.throws(() => parseProposal(proposal), /action or summary/i, proposal);
  }

  assert.equal(parseProposal('Summary: document the release').summary, 'document the release');
  assert.equal(parseProposal('{"summary":"document the release"}').summary, 'document the release');
});
test('checks generated packet structure', () => { const md = packetToMarkdown(createApprovalPacket({ action: 'document only' })); assert.equal(checkPacketText(md).ok, true); });
test('ignores packet headings inside backtick and tilde fenced code blocks', () => {
  const required = ['# Action Approval Packet', '## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase'];
  for (const fence of ['```markdown', '~~~~ markdown']) {
    const result = checkPacketText([fence, ...required.flatMap(heading => [heading, 'example']), fence.startsWith('`') ? '```' : '~~~~'].join('\n'));
    assert.equal(result.ok, false, fence);
    assert.deepEqual(result.missing, required, fence);
    assert.equal(result.title.position, 'missing', fence);
  }
});
test('uses only unfenced headings while preserving headings after fence closure', () => {
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));
  const fencedExamples = ['```markdown', '## Rollback', 'example', '```', '~~~', '## Side Effects', 'example', '~~~'].join('\n');
  const result = checkPacketText(valid.replace('## Side Effects', `${fencedExamples}\n## Side Effects`));

  assert.equal(result.ok, true);
  assert.deepEqual(result.duplicates, []);
  assert.deepEqual(result.outOfOrder, []);

  const unclosed = checkPacketText(valid.replace('## Side Effects', '```markdown\n## Side Effects'));
  assert.equal(unclosed.ok, false);
  assert.deepEqual(unclosed.missing, ['## Side Effects', '## Rollback', '## Required Approval Phrase']);
});
test('keeps multiline scalar proposal fields inside one packet structure', () => {
  const packet = createApprovalPacket({
    title: 'Release update\n# Action Approval Packet',
    action: 'send update\n## Side Effects\n- duplicate-looking content',
    system: 'Slack\n## Rollback',
    rollback: 'retract message\n## Required Approval Phrase',
    approval: 'APPROVE UPDATE\n## Proposed Action',
  });
  const markdown = packetToMarkdown(packet);
  const result = checkPacketText(markdown);

  assert.equal(result.ok, true);
  assert.deepEqual(result.duplicates, []);
  assert.deepEqual(result.outOfOrder, []);
  assert.match(markdown, /send update ## Side Effects - duplicate-looking content/);
  assert.match(markdown, /retract message ## Required Approval Phrase/);
});
test('normalizes multiline list values without creating packet headings', () => {
  const packet = createApprovalPacket({
    action: 'send update',
    sideEffects: ['external message\n## Rollback'],
    sensitiveFields: ['email\r\n## Proposed Action'],
    evidence: ['test output\u2028## Required Approval Phrase'],
  });
  const markdown = packetToMarkdown(packet);

  assert.equal(checkPacketText(markdown).ok, true);
  assert.match(markdown, /- external message ## Rollback/);
  assert.match(markdown, /- email ## Proposed Action/);
  assert.match(markdown, /- test output ## Required Approval Phrase/);
});
test('escapes leading heading text and supplies semantic fallbacks after normalization', () => {
  const packet = createApprovalPacket({ action: '## Proposed Action', rollback: '\n', approval: '\r\n' });
  const markdown = packetToMarkdown(packet);

  assert.equal(checkPacketText(markdown).ok, true);
  assert.match(markdown, /## Proposed Action\n\\## Proposed Action/);
  assert.match(markdown, /## Rollback\nNot provided/);
  assert.match(markdown, /## Required Approval Phrase\nAPPROVE ACTION/);
});
test('requires the packet title and semantic sections in generated order', () => {
  const reordered = [
    '# Action Approval Packet',
    '## Side Effects',
    '- None detected',
    '## Proposed Action',
    'document only',
    '## Rollback',
    'Not provided',
    '## Required Approval Phrase',
    'APPROVE ACTION',
  ].join('\n');
  const result = checkPacketText(reordered);
  assert.equal(result.ok, false);
  assert.deepEqual(result.outOfOrder, ['## Proposed Action', '## Side Effects']);
});
test('requires the packet title before packet content', () => {
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));
  for (const malformed of [`preamble\n${valid}`, `## Rollback\nNot provided\n${valid}`]) {
    const result = checkPacketText(malformed);
    assert.equal(result.ok, false);
    assert.equal(result.title.position, 'misplaced');
  }
});
test('rejects duplicate required headings as ambiguous packet structure', () => {
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));
  const duplicate = valid.replace('## Rollback\n', '## Rollback\nNot provided\n## Rollback\n');
  const result = checkPacketText(duplicate);
  assert.equal(result.ok, false);
  assert.deepEqual(result.duplicates, ['## Rollback']);
});
test('rejects comment-only semantic packet sections', () => {
  const requiredSections = ['## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase'];
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));
  for (const heading of requiredSections) {
    const commentOnly = valid.replace(new RegExp(`(${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})\\n[^#]+`), '$1\n<!-- intentionally absent -->\n');
    const result = checkPacketText(commentOnly);
    assert.equal(result.ok, false, heading);
    assert.deepEqual(result.empty, [heading]);
  }
});
test('requires content in every semantic packet section', () => {
  const requiredSections = ['## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase'];
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));

  for (const heading of requiredSections) {
    for (const body of ['', '   \n\t']) {
      const emptyPacket = valid.replace(new RegExp(`(${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})\\n[^#]+`), `$1\n${body}\n`);
      const result = checkPacketText(emptyPacket);
      assert.equal(result.ok, false, `${heading} with ${JSON.stringify(body)}`);
      assert.deepEqual(result.empty, [heading]);
    }
  }
});
test('rejects Markdown-marker-only semantic packet sections', () => {
  const requiredSections = ['## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase'];
  const markerBodies = ['-', '*', '+', '1.', '1)', '>', '> -', '- [ ]', '- [x]', '```', '---'];
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));

  for (const heading of requiredSections) {
    for (const body of markerBodies) {
      const markerOnly = valid.replace(new RegExp(`(${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})\\n[^#]+`), `$1\n${body}\n`);
      const result = checkPacketText(markerOnly);
      assert.equal(result.ok, false, `${heading} with ${JSON.stringify(body)}`);
      assert.deepEqual(result.empty, [heading]);
    }
  }
});
test('accepts semantic content following Markdown structural markers', () => {
  const valid = packetToMarkdown(createApprovalPacket({ action: 'document only' }));
  for (const body of ['- send message', '- [ ] confirm approval', '> restore backup', '1. APPROVE ACTION']) {
    const packet = valid.replace(/(## Proposed Action)\n[^#]+/, `$1\n${body}\n`);
    assert.equal(checkPacketText(packet).ok, true, body);
  }
});
test('check CLI rejects heading-only packets with machine-reviewable output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-empty-'));
  const packet = join(directory, 'packet.md');
  writeFileSync(packet, '# Action Approval Packet\n## Proposed Action\n## Side Effects\n## Rollback\n## Required Approval Phrase\n');
  const result = spawnSync('node', ['dist/cli.js', 'check', packet], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, false);
  assert.deepEqual(output.missing, []);
  assert.deepEqual(output.empty, ['## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase']);
});
test('check CLI rejects packets whose required structure exists only inside fenced examples', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-fenced-'));
  const packet = join(directory, 'packet.md');
  writeFileSync(packet, '```markdown\n# Action Approval Packet\n## Proposed Action\nsend\n## Side Effects\nmessage\n## Rollback\nretract\n## Required Approval Phrase\nAPPROVE ACTION\n```\n');
  const result = spawnSync('node', ['dist/cli.js', 'check', packet], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.missing, ['# Action Approval Packet', '## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase']);
});
test('check CLI rejects marker-only packet bodies with machine-reviewable output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-markers-'));
  const packet = join(directory, 'packet.md');
  writeFileSync(packet, '# Action Approval Packet\n## Proposed Action\n-\n## Side Effects\n- [ ]\n## Rollback\n>\n## Required Approval Phrase\n1.\n');
  const result = spawnSync('node', ['dist/cli.js', 'check', packet], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.empty, ['## Proposed Action', '## Side Effects', '## Rollback', '## Required Approval Phrase']);
});
test('check CLI rejects reordered packets with machine-reviewable output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-order-'));
  const packet = join(directory, 'packet.md');
  writeFileSync(packet, '# Action Approval Packet\n## Side Effects\n- send\n## Proposed Action\nsend message\n## Rollback\nretract\n## Required Approval Phrase\nAPPROVE ACTION\n');
  const result = spawnSync('node', ['dist/cli.js', 'check', packet], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, false);
  assert.deepEqual(output.outOfOrder, ['## Proposed Action', '## Side Effects']);
});
test('rejects malformed proposal shapes and field types', () => {
  for (const proposal of ['null', '[]', '{"action":42}', '{"sideEffects":"send"}', '{"evidence":[1]}']) {
    assert.throws(() => parseProposal(proposal), /proposal/i);
  }
});
test('requires standalone packet headings', () => {
  const forged = [
    '# Action Approval Packet',
    '## Side Effects',
    '- mentions ## Rollback and ## Required Approval Phrase',
  ].join('\n');
  const result = checkPacketText(forged);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['## Proposed Action', '## Rollback', '## Required Approval Phrase']);
  assert.deepEqual(result.empty, []);
});
test('plan reports invalid proposals without producing a packet', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-'));
  const proposal = join(directory, 'proposal.json');
  writeFileSync(proposal, 'null\n');
  const result = spawnSync('node', ['dist/cli.js', 'plan', proposal, '--format', 'json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid proposal/i);
  assert.equal(result.stdout, '');
});
test('plan gives Markdown and JSON Actor fields identical classification behavior', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-actor-'));
  const markdownPath = join(directory, 'proposal.md');
  const jsonPath = join(directory, 'proposal.json');
  writeFileSync(markdownPath, 'Action: review item\nActor:   GitHub App   \n');
  writeFileSync(jsonPath, JSON.stringify({ action: 'review item', actor: 'GitHub App' }));

  const outputs = [markdownPath, jsonPath].map(proposal => JSON.parse(
    execFileSync('node', ['dist/cli.js', 'plan', proposal, '--format', 'json'], { encoding: 'utf8' }),
  ));
  assert.deepEqual(outputs.map(packet => packet.system), ['github', 'github']);
  assert.deepEqual(outputs[0], outputs[1]);
});
test('plan gives Markdown and JSON list whitespace identical packet semantics', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-whitespace-'));
  const markdownPath = join(directory, 'proposal.md');
  const jsonPath = join(directory, 'proposal.json');
  writeFileSync(markdownPath, 'Action: document the release\nSide Effects: , external notification, \nSensitive Fields: , customer email, \nEvidence: , npm test, \nRollback:   \n');
  writeFileSync(jsonPath, JSON.stringify({
    action: 'document the release',
    sideEffects: [' ', 'external notification', ''],
    sensitiveFields: [' ', 'customer email'],
    evidence: ['', 'npm test', ' '],
    rollback: '   ',
  }));

  const outputs = [markdownPath, jsonPath].map(proposal => JSON.parse(
    execFileSync('node', ['dist/cli.js', 'plan', proposal, '--format', 'json'], { encoding: 'utf8' }),
  ));
  assert.deepEqual(outputs[0], outputs[1]);
  assert.deepEqual(outputs[0].sideEffects, ['external notification']);
  assert.deepEqual(outputs[0].sensitiveFields, ['customer email']);
  assert.deepEqual(outputs[0].evidence, ['npm test']);
  assert.equal(outputs[0].rollback, 'Not provided');
  assert.ok(outputs[0].warnings.includes('Rollback notes missing.'));
});
test('plan uses a nonblank summary when the JSON action is blank', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-summary-'));
  const proposal = join(directory, 'proposal.json');
  writeFileSync(proposal, JSON.stringify({
    action: '   ',
    summary: 'send a message to the launch channel',
    system: 'slack',
  }));

  const json = JSON.parse(execFileSync(
    'node', ['dist/cli.js', 'plan', proposal, '--format', 'json'], { encoding: 'utf8' },
  ));
  const markdown = execFileSync(
    'node', ['dist/cli.js', 'plan', proposal, '--format', 'markdown'], { encoding: 'utf8' },
  );
  assert.equal(json.action, 'send a message to the launch channel');
  assert.equal(json.title, 'send a message to the launch channel');
  assert.equal(json.requiresApproval, true);
  assert.match(markdown, /- Title: send a message to the launch channel/);
  assert.match(markdown, /## Proposed Action\nsend a message to the launch channel/);
  assert.match(markdown, /- Requires approval: yes/);
});
test('plan rejects unstructured Markdown without producing a packet', () => {
  const result = spawnSync('node', ['dist/cli.js', 'plan', 'fixtures/unstructured.md', '--format', 'json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /action or summary/i);
  assert.equal(result.stdout, '');
});
test('rejects invalid plan arguments without producing a packet', () => {
  const invalidArguments = [
    ['plan', 'fixtures/slack-message.json', '--format', 'yaml'],
    ['plan', 'fixtures/slack-message.json', '--format'],
    ['plan', 'fixtures/slack-message.json', '--unknown'],
    ['plan', 'fixtures/slack-message.json', 'stray'],
  ];

  for (const args of invalidArguments) {
    const result = spawnSync('node', ['dist/cli.js', ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, args.join(' '));
    assert.match(result.stderr, /Error:/);
    assert.equal(result.stdout, '');
  }
});
test('rejects invalid check arguments without producing output', () => {
  for (const extra of ['--format', '--unknown', 'stray']) {
    const result = spawnSync('node', ['dist/cli.js', 'check', 'fixtures/slack-message.json', extra], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Error:/);
    assert.equal(result.stdout, '');
  }
});
test('reports missing and unreadable CLI inputs without stack traces', () => {
  const directory = mkdtempSync(join(tmpdir(), 'action-approval-unreadable-'));
  const unreadable = join(directory, 'directory');
  mkdirSync(unreadable);

  for (const [command, file] of [['plan', join(directory, 'missing.json')], ['check', join(directory, 'missing.md')], ['plan', unreadable], ['check', unreadable]]) {
    const result = spawnSync('node', ['dist/cli.js', command, file], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /^Error: /);
    assert.doesNotMatch(result.stderr, /\n\s+at |node:fs/);
    assert.equal(result.stdout, '');
  }
});
test('requires a file for plan and check', () => {
  for (const command of ['plan', 'check']) {
    const result = spawnSync('node', ['dist/cli.js', command], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires a file/);
    assert.equal(result.stdout, '');
  }
});
test('prints usage help', () => {
  const output = execFileSync('node', ['dist/cli.js', '--help'], { encoding: 'utf8' });
  assert.match(output, /Usage: action-approval-skill/);
  assert.match(output, /plan <proposal>/);
  assert.match(output, /check <packet\.md>/);
});

test('prints package version metadata', () => {
  const output = execFileSync('node', ['dist/cli.js', '--version'], { encoding: 'utf8' });
  assert.equal(output, '0.1.0\n');
});
