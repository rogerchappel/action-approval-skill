#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function requirePath(relativePath, label = relativePath) {
  if (!existsSync(join(root, relativePath))) {
    throw new Error(`${label} is missing from the package surface: ${relativePath}`);
  }
}

for (const [name, target] of Object.entries(pkg.bin ?? {})) {
  requirePath(target, `bin target ${name}`);
}

for (const required of [
  'dist/index.js',
  'SKILL.md',
  'docs/VERIFICATION.md',
  'fixtures/slack-message.json',
  'fixtures/repository-push.json',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
]) {
  requirePath(required);
}

const files = new Set(pkg.files ?? []);
for (const required of [
  'dist',
  'SKILL.md',
  'docs',
  'fixtures',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
]) {
  if (!files.has(required)) {
    throw new Error(`package.json files is missing ${required}`);
  }
}

execFileSync('npm', ['pack', '--dry-run'], {
  cwd: root,
  stdio: 'inherit',
});
