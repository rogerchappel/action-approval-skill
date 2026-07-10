#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { checkPacketText, loadPacketFromFile, packetToMarkdown } from './index.js';
const [, , cmd, file, ...args] = process.argv;
const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'markdown';
const usage = 'Usage: action-approval-skill plan <proposal> [--format markdown|json] | check <packet.md>';
if (cmd === '--help' || cmd === '-h') { console.log(usage); process.exit(0); }
if (cmd === '--version') { const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')); console.log(pkg.version); process.exit(0); }
if (!cmd || !file || !['plan','check'].includes(cmd)) { console.error(usage); process.exit(2); }
if (cmd === 'plan') { const packet = loadPacketFromFile(file); console.log(format === 'json' ? JSON.stringify(packet,null,2) : packetToMarkdown(packet)); }
if (cmd === 'check') { const result = checkPacketText(readFileSync(file,'utf8')); console.log(JSON.stringify(result,null,2)); process.exit(result.ok ? 0 : 1); }
