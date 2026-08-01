#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { checkPacketText, loadPacketFromFile, packetToMarkdown } from './index.js';
const usage = 'Usage: action-approval-skill plan <proposal> [--format markdown|json] | check <packet.md>';
const argv = process.argv.slice(2);
const fail = (message: string, status = 2): never => {
  console.error(`Error: ${message}`);
  process.exit(status);
};

if ((argv[0] === '--help' || argv[0] === '-h') && argv.length === 1) { console.log(usage); process.exit(0); }
if (argv[0] === '--version' && argv.length === 1) { const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')); console.log(pkg.version); process.exit(0); }

const [cmd, file, ...args] = argv;
if (!cmd || !['plan', 'check'].includes(cmd)) fail(usage);
if (!file) fail(`${cmd} requires a file\n${usage}`);

if (cmd === 'plan') {
  let format = 'markdown';
  if (args.length > 0) {
    if (args[0] !== '--format') fail(`unknown option or argument: ${args[0]}\n${usage}`);
    if (!args[1]) fail('--format requires markdown or json');
    if (args.length > 2) fail(`unexpected argument: ${args[2]}\n${usage}`);
    if (!['markdown', 'json'].includes(args[1])) fail(`unsupported format: ${args[1]}`);
    format = args[1];
  }
  try {
    const packet = loadPacketFromFile(file);
    console.log(format === 'json' ? JSON.stringify(packet,null,2) : packetToMarkdown(packet));
  } catch (error) {
    fail(error instanceof Error ? error.message : 'invalid proposal', 1);
  }
}
if (cmd === 'check') {
  if (args.length > 0) fail(`unexpected option or argument: ${args[0]}\n${usage}`);
  try {
    const result = checkPacketText(readFileSync(file,'utf8'));
    console.log(JSON.stringify(result,null,2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'unable to read packet', 1);
  }
}
