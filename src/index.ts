import { readFileSync } from 'node:fs';

export type ApprovalRisk = 'low' | 'medium' | 'high';
export type ProposalInput = { title?: string; action?: string; system?: string; actor?: string; target?: string; summary?: string; sideEffects?: string[]; sensitiveFields?: string[]; evidence?: string[]; rollback?: string; approval?: string; };
export type ApprovalPacket = { title: string; action: string; system: string; risk: ApprovalRisk; requiresApproval: boolean; sideEffects: string[]; sensitiveFields: string[]; evidence: string[]; rollback: string; checklist: string[]; approvalPhrase: string; warnings: string[]; };
const highRisk = ['send','post','push','delete','invite','charge','email','message'];
const sensitive = ['token','secret','password','customer','email','phone','address','private','credential'];

export function parseProposal(text: string): ProposalInput {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('proposal is empty');
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as ProposalInput;
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
  return out;
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
function inferSideEffects(text:string, action:string){ return highRisk.filter(w => text.includes(w) || action.toLowerCase().includes(w)).map(w => w === 'push' ? 'repository push' : w); }
export function packetToMarkdown(packet: ApprovalPacket): string {
  return ['# Action Approval Packet', '', `- Title: ${packet.title}`, `- System: ${packet.system}`, `- Risk: ${packet.risk}`, `- Requires approval: ${packet.requiresApproval ? 'yes' : 'no'}`, '', '## Proposed Action', packet.action, '', '## Side Effects', ...(packet.sideEffects.length ? packet.sideEffects.map(s => `- ${s}`) : ['- None detected']), '', '## Sensitive Fields', ...(packet.sensitiveFields.length ? packet.sensitiveFields.map(s => `- ${s}`) : ['- None detected']), '', '## Evidence', ...(packet.evidence.length ? packet.evidence.map(e => `- ${e}`) : ['- Not provided']), '', '## Rollback', packet.rollback, '', '## Approval Checklist', ...packet.checklist.map(c => `- [ ] ${c}`), '', '## Required Approval Phrase', packet.approvalPhrase, '', '## Warnings', ...(packet.warnings.length ? packet.warnings.map(w => `- ${w}`) : ['- None'])].join('\n');
}
export function loadPacketFromFile(file: string){ return createApprovalPacket(parseProposal(readFileSync(file,'utf8'))); }
export function checkPacketText(text: string){ const required = ['# Action Approval Packet','## Side Effects','## Rollback','## Required Approval Phrase']; return { ok: required.every(r => text.includes(r)), missing: required.filter(r => !text.includes(r)) }; }
