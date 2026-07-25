import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
test('parses markdown proposal fields', () => { const parsed = parseProposal('Title: Demo\nAction: create GitHub issue\nEvidence: log.txt'); assert.equal(parsed.title, 'Demo'); assert.deepEqual(parsed.evidence, ['log.txt']); });
test('checks generated packet structure', () => { const md = packetToMarkdown(createApprovalPacket({ action: 'document only' })); assert.equal(checkPacketText(md).ok, true); });
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
  assert.deepEqual(result.missing, ['## Rollback', '## Required Approval Phrase']);
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
