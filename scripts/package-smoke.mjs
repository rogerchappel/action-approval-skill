#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const required = [
  'package/dist/cli.js',
  'package/dist/index.js',
  'package/SKILL.md',
  'package/README.md',
  'package/LICENSE',
  'package/SECURITY.md',
  'package/CHANGELOG.md',
  'package/CONTRIBUTING.md',
  'package/fixtures/slack-message.json',
  'package/fixtures/repository-push.json',
  'package/docs/VERIFICATION.md'
];

const dir = mkdtempSync(join(tmpdir(), 'action-approval-pack-'));

try {
  const tarball = execFileSync('npm', ['pack', '--silent'], { encoding: 'utf8' }).trim();
  execFileSync('tar', ['-xzf', tarball, '-C', dir]);
  const contents = execFileSync('find', [join(dir, 'package'), '-type', 'f'], { encoding: 'utf8' });

  for (const file of required) {
    const path = join(dir, file);
    if (!contents.includes(path)) {
      throw new Error(`packed tarball missing ${file}`);
    }
  }

  execFileSync('node', [join(dir, 'package/dist/cli.js'), 'plan', 'fixtures/slack-message.json', '--format', 'json'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });

  console.log(`package smoke passed for ${tarball}`);
  rmSync(tarball, { force: true });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
