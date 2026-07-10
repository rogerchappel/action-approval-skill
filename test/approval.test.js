import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createApprovalPacket, parseProposal, packetToMarkdown, checkPacketText } from '../dist/index.js';

test('classifies side-effect proposals as approval required', () => { const packet = createApprovalPacket({ action: 'send Slack message', sideEffects: ['external message'], sensitiveFields: ['email'] }); assert.equal(packet.requiresApproval, true); assert.equal(packet.risk, 'high'); });
test('parses markdown proposal fields', () => { const parsed = parseProposal('Title: Demo\nAction: create GitHub issue\nEvidence: log.txt'); assert.equal(parsed.title, 'Demo'); assert.deepEqual(parsed.evidence, ['log.txt']); });
test('checks generated packet structure', () => { const md = packetToMarkdown(createApprovalPacket({ action: 'document only' })); assert.equal(checkPacketText(md).ok, true); });
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
