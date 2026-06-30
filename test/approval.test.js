import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApprovalPacket, parseProposal, packetToMarkdown, checkPacketText } from '../dist/index.js';

test('classifies side-effect proposals as approval required', () => { const packet = createApprovalPacket({ action: 'send Slack message', sideEffects: ['external message'], sensitiveFields: ['email'] }); assert.equal(packet.requiresApproval, true); assert.equal(packet.risk, 'high'); });
test('parses markdown proposal fields', () => { const parsed = parseProposal('Title: Demo\nAction: create GitHub issue\nEvidence: log.txt'); assert.equal(parsed.title, 'Demo'); assert.deepEqual(parsed.evidence, ['log.txt']); });
test('checks generated packet structure', () => { const md = packetToMarkdown(createApprovalPacket({ action: 'document only' })); assert.equal(checkPacketText(md).ok, true); });
test('classifies TweetClaw reply fixture as high-risk approval work', () => {
  const fixture = JSON.parse(readFileSync('fixtures/tweetclaw-reply.json', 'utf8'));
  const packet = createApprovalPacket(fixture);
  assert.equal(packet.system, 'TweetClaw OpenClaw plugin');
  assert.equal(packet.requiresApproval, true);
  assert.equal(packet.risk, 'high');
  assert.equal(packet.approvalPhrase, 'APPROVE TWEETCLAW REPLY');
  assert.deepEqual(packet.evidence, [
    'target tweet URL confirmed',
    'draft reply reviewed against brand voice'
  ]);
});
