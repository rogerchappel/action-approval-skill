import { readFileSync } from 'node:fs';

export type ApprovalRisk = 'low' | 'medium' | 'high';
export type ProposalInput = { title?: string; action?: string; system?: string; actor?: string; target?: string; summary?: string; sideEffects?: string[]; sensitiveFields?: string[]; evidence?: string[]; rollback?: string; approval?: string; };
export type ApprovalPacket = { title: string; action: string; system: string; risk: ApprovalRisk; requiresApproval: boolean; sideEffects: string[]; sensitiveFields: string[]; evidence: string[]; rollback: string; checklist: string[]; approvalPhrase: string; warnings: string[]; };
const highRisk = ['send','post','push','delete','invite','charge','email','message'];
const sensitive = ['token','secret','password','customer','email','phone','address','private','credential'];
const stringFields = ['title', 'action', 'system', 'actor', 'target', 'summary', 'rollback', 'approval'] as const;
const stringArrayFields = ['sideEffects', 'sensitiveFields', 'evidence'] as const;

function validateProposal(value: unknown): ProposalInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid proposal: expected a JSON object or structured Markdown fields');
  }
  const proposal = value as Record<string, unknown>;
  for (const field of stringFields) {
    if (proposal[field] !== undefined && typeof proposal[field] !== 'string') {
      throw new Error(`invalid proposal: "${field}" must be a string`);
    }
  }
  for (const field of stringArrayFields) {
    const value = proposal[field];
    if (value !== undefined && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) {
      throw new Error(`invalid proposal: "${field}" must be an array of strings`);
    }
  }
  if (![proposal.action, proposal.summary].some(value => typeof value === 'string' && value.trim().length > 0)) {
    throw new Error('invalid proposal: expected a non-empty action or summary');
  }
  return proposal as ProposalInput;
}

export function parseProposal(text: string): ProposalInput {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('proposal is empty');
  if (/^[{[]/.test(trimmed) || /^(null|true|false|-?\d)/.test(trimmed)) {
    return validateProposal(JSON.parse(trimmed) as unknown);
  }
  const out: ProposalInput = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^[-*# ]*([A-Za-z ]+):\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '');
    const val = match[2].trim();
    if (key === 'title') out.title = val;
    if (key === 'action') out.action = val;
    if (key === 'system') out.system = val;
    if (key === 'target') out.target = val;
    if (key === 'summary') out.summary = val;
    if (key === 'rollback') out.rollback = val;
    if (key === 'approval') out.approval = val;
    if (key === 'sideeffects') out.sideEffects = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'sensitivefields') out.sensitiveFields = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'evidence') out.evidence = val.split(',').map(s => s.trim()).filter(Boolean);
  }
  return validateProposal(out);
}

export function createApprovalPacket(input: ProposalInput): ApprovalPacket {
  const text = JSON.stringify(input).toLowerCase();
  const action = input.action ?? input.summary ?? 'unspecified action';
  const system = input.system ?? inferSystem(text);
  const sideEffects = input.sideEffects?.length ? input.sideEffects : inferSideEffects(text, action);
  const sensitiveFields = input.sensitiveFields?.length ? input.sensitiveFields : sensitive.filter(w => text.includes(w));
  const risk: ApprovalRisk = sideEffects.some(s => highRisk.some(w => s.toLowerCase().includes(w))) || sensitiveFields.length > 0 ? 'high' : sideEffects.length ? 'medium' : 'low';
  const warnings: string[] = [];
  if (!input.rollback) warnings.push('Rollback notes missing.');
  if (!input.evidence?.length) warnings.push('Evidence links missing.');
  if (sensitiveFields.length) warnings.push('Sensitive data detected; redact before sharing broadly.');
  return { title: input.title ?? action, action, system, risk, requiresApproval: risk !== 'low' || sideEffects.length > 0, sideEffects, sensitiveFields, evidence: input.evidence ?? [], rollback: input.rollback ?? 'Not provided', checklist: ['Dry-run packet reviewed','Target system and recipient confirmed','Sensitive fields redacted or justified','Rollback owner named','Explicit approver phrase captured'], approvalPhrase: input.approval ?? 'APPROVE ACTION', warnings };
}
function inferSystem(text:string){ if(text.includes('slack')) return 'slack'; if(text.includes('github')) return 'github'; if(text.includes('crm')||text.includes('salesforce')) return 'crm'; return 'external system'; }
function inferSideEffects(text:string, action:string){
  const actionText = action.toLowerCase();
  const inferred = highRisk.filter(w => text.includes(w) || actionText.includes(w)).map(w => w === 'push' ? 'repository push' : w);
  if (/\bupdate\b/.test(actionText) && /\b(crm|record)\b/.test(actionText)) inferred.push('record update');
  if (/\bcreate\b/.test(actionText) && /\b(ticket|issue)\b/.test(actionText)) inferred.push('ticket creation');
  return inferred;
}
export function packetToMarkdown(packet: ApprovalPacket): string {
  return ['# Action Approval Packet', '', `- Title: ${packet.title}`, `- System: ${packet.system}`, `- Risk: ${packet.risk}`, `- Requires approval: ${packet.requiresApproval ? 'yes' : 'no'}`, '', '## Proposed Action', packet.action, '', '## Side Effects', ...(packet.sideEffects.length ? packet.sideEffects.map(s => `- ${s}`) : ['- None detected']), '', '## Sensitive Fields', ...(packet.sensitiveFields.length ? packet.sensitiveFields.map(s => `- ${s}`) : ['- None detected']), '', '## Evidence', ...(packet.evidence.length ? packet.evidence.map(e => `- ${e}`) : ['- Not provided']), '', '## Rollback', packet.rollback, '', '## Approval Checklist', ...packet.checklist.map(c => `- [ ] ${c}`), '', '## Required Approval Phrase', packet.approvalPhrase, '', '## Warnings', ...(packet.warnings.length ? packet.warnings.map(w => `- ${w}`) : ['- None'])].join('\n');
}
export function loadPacketFromFile(file: string){ return createApprovalPacket(parseProposal(readFileSync(file,'utf8'))); }
export function checkPacketText(text: string){
  const packetHeading = '# Action Approval Packet';
  const requiredSections = ['## Proposed Action','## Side Effects','## Rollback','## Required Approval Phrase'];
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, comment => comment.replace(/[^\r\n]/g, ''));
  const lines = withoutComments.split(/\r?\n/);
  const headings = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const heading = line.trim();
    if (/^#{1,6}\s+\S/.test(heading)) headings.set(heading, [...(headings.get(heading) ?? []), index]);
  });
  const required = [packetHeading, ...requiredSections];
  const missing = required.filter(heading => !headings.has(heading));
  const duplicates = required.filter(heading => (headings.get(heading)?.length ?? 0) > 1);
  const firstContent = lines.findIndex(line => line.trim().length > 0);
  const titleIndex = headings.get(packetHeading)?.[0];
  const title = {
    position: titleIndex === undefined ? 'missing' : titleIndex === firstContent ? 'valid' : 'misplaced',
    count: headings.get(packetHeading)?.length ?? 0,
  };
  const presentSections = requiredSections.filter(heading => headings.has(heading));
  const outOfOrder = presentSections.filter((heading, index) => presentSections.some((other, otherIndex) =>
    (index < otherIndex) !== ((headings.get(heading)?.[0] ?? 0) < (headings.get(other)?.[0] ?? 0))
  ));
  const empty = requiredSections.filter(heading => {
    const start = headings.get(heading)?.[0];
    if (start === undefined) return false;
    const nextHeading = lines.findIndex((line, index) => index > start && /^#{1,6}\s+\S/.test(line.trim()));
    const end = nextHeading === -1 ? lines.length : nextHeading;
    return !lines.slice(start + 1, end).some(line => line.trim().length > 0);
  });
  return {
    ok: missing.length === 0 && duplicates.length === 0 && title.position === 'valid' && outOfOrder.length === 0 && empty.length === 0,
    missing,
    duplicates,
    outOfOrder,
    empty,
    title,
  };
}
