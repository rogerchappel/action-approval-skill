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
    if (key === 'actor') out.actor = val;
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
  const action = nonBlank(input.action) ?? nonBlank(input.summary) ?? 'unspecified action';
  const classificationText = [input.action, input.summary, input.system, input.actor, input.target]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const system = nonBlank(input.system) ?? inferSystem(classificationText);
  const sideEffects = input.sideEffects !== undefined ? normalizeList(input.sideEffects) : inferSideEffects(action);
  const sensitiveFields = input.sensitiveFields !== undefined
    ? normalizeList(input.sensitiveFields)
    : sensitive.filter(keyword => containsKeyword(classificationText, keyword));
  const evidence = normalizeList(input.evidence ?? []);
  const rollback = nonBlank(input.rollback);
  const risk: ApprovalRisk = sideEffects.some(effect => highRisk.some(keyword => containsKeyword(effect, keyword))) || sensitiveFields.length > 0 ? 'high' : sideEffects.length ? 'medium' : 'low';
  const warnings: string[] = [];
  if (!rollback) warnings.push('Rollback notes missing.');
  if (!evidence.length) warnings.push('Evidence links missing.');
  if (sensitiveFields.length) warnings.push('Sensitive data detected; redact before sharing broadly.');
  return { title: nonBlank(input.title) ?? action, action, system, risk, requiresApproval: risk !== 'low' || sideEffects.length > 0, sideEffects, sensitiveFields, evidence, rollback: rollback ?? 'Not provided', checklist: ['Dry-run packet reviewed','Target system and recipient confirmed','Sensitive fields redacted or justified','Rollback owner named','Explicit approver phrase captured'], approvalPhrase: nonBlank(input.approval) ?? 'APPROVE ACTION', warnings };
}
function nonBlank(value: string | undefined) { const normalized = value?.trim(); return normalized || undefined; }
function normalizeList(values: string[]) { return values.map(value => value.trim()).filter(Boolean); }
function inferSystem(text:string){ if(text.includes('slack')) return 'slack'; if(text.includes('github')) return 'github'; if(text.includes('crm')||text.includes('salesforce')) return 'crm'; return 'external system'; }
function containsKeyword(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text);
}
function inferSideEffects(action:string){
  const actionText = action.toLowerCase();
  const inferred = highRisk.filter(keyword => containsKeyword(actionText, keyword)).map(keyword => keyword === 'push' ? 'repository push' : keyword);
  if (/\bupdate\b/.test(actionText) && /\b(crm|record)\b/.test(actionText)) inferred.push('record update');
  if (/\bcreate\b/.test(actionText) && /\b(ticket|issue)\b/.test(actionText)) inferred.push('ticket creation');
  return inferred;
}
export function packetToMarkdown(packet: ApprovalPacket): string {
  const inline = (value: string, fallback = '(empty)') => {
    const normalized = value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() || fallback;
    return normalized.replace(/^(#{1,6})(?=\s)/, '\\$1');
  };
  return ['# Action Approval Packet', '', `- Title: ${inline(packet.title, 'Untitled action')}`, `- System: ${inline(packet.system, 'external system')}`, `- Risk: ${packet.risk}`, `- Requires approval: ${packet.requiresApproval ? 'yes' : 'no'}`, '', '## Proposed Action', inline(packet.action, 'unspecified action'), '', '## Side Effects', ...(packet.sideEffects.length ? packet.sideEffects.map(s => `- ${inline(s)}`) : ['- None detected']), '', '## Sensitive Fields', ...(packet.sensitiveFields.length ? packet.sensitiveFields.map(s => `- ${inline(s)}`) : ['- None detected']), '', '## Evidence', ...(packet.evidence.length ? packet.evidence.map(e => `- ${inline(e)}`) : ['- Not provided']), '', '## Rollback', inline(packet.rollback, 'Not provided'), '', '## Approval Checklist', ...packet.checklist.map(c => `- [ ] ${inline(c)}`), '', '## Required Approval Phrase', inline(packet.approvalPhrase, 'APPROVE ACTION'), '', '## Warnings', ...(packet.warnings.length ? packet.warnings.map(w => `- ${inline(w)}`) : ['- None'])].join('\n');
}
export function loadPacketFromFile(file: string){ return createApprovalPacket(parseProposal(readFileSync(file,'utf8'))); }
export function checkPacketText(text: string){
  const packetHeading = '# Action Approval Packet';
  const requiredSections = ['## Proposed Action','## Side Effects','## Rollback','## Required Approval Phrase'];
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, comment => comment.replace(/[^\r\n]/g, ''));
  const lines = withoutComments.split(/\r?\n/);
  let fence: { marker: '`' | '~'; length: number } | undefined;
  const structuralLines = lines.map(line => {
    const candidate = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence) {
      if (!candidate || (candidate[1][0] === '`' && candidate[2].includes('`'))) return line;
      fence = { marker: candidate[1][0] as '`' | '~', length: candidate[1].length };
      return '';
    }
    if (candidate && candidate[1][0] === fence.marker && candidate[1].length >= fence.length && candidate[2].trim() === '') fence = undefined;
    return '';
  });
  const hasSemanticContent = (line: string) => {
    let content = line.trim();
    content = content.replace(/^(?:>\s*)+/, '').trim();
    if (/^(?:`{3,}|~{3,}|[-*_](?:\s*[-*_]){2,})$/.test(content)) return false;
    content = content.replace(/^(?:(?:[-+*]|\d+[.)])\s*)/, '').trim();
    content = content.replace(/^\[(?: |x|X)\]\s*/, '').trim();
    return content.length > 0;
  };
  const headings = new Map<string, number[]>();
  structuralLines.forEach((line, index) => {
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
    const nextHeading = structuralLines.findIndex((line, index) => index > start && /^#{1,6}\s+\S/.test(line.trim()));
    const end = nextHeading === -1 ? lines.length : nextHeading;
    return !structuralLines.slice(start + 1, end).some(hasSemanticContent);
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
