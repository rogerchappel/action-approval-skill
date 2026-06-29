#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { checkPacketText, loadPacketFromFile, packetToMarkdown } from './index.js';
const [, , cmd, file, ...args] = process.argv;
const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'markdown';
if (!cmd || !file || !['plan','check'].includes(cmd)) { console.error('Usage: action-approval-skill plan <proposal> [--format markdown|json] | check <packet.md>'); process.exit(2); }
if (cmd === 'plan') { const packet = loadPacketFromFile(file); console.log(format === 'json' ? JSON.stringify(packet,null,2) : packetToMarkdown(packet)); }
if (cmd === 'check') { const result = checkPacketText(readFileSync(file,'utf8')); console.log(JSON.stringify(result,null,2)); process.exit(result.ok ? 0 : 1); }
