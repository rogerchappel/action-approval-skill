#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
  'package/scripts/validate-release-readiness.mjs',
  'package/fixtures/slack-message.json',
  'package/fixtures/repository-push.json',
  'package/fixtures/unstructured.md',
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

  const packedPackage = JSON.parse(readFileSync(join(dir, 'package/package.json'), 'utf8'));
  if (packedPackage.bin?.['action-approval-skill'] !== 'dist/cli.js') {
    throw new Error('packed package.json missing action-approval-skill bin target');
  }

  execFileSync('node', ['dist/cli.js', 'plan', 'fixtures/slack-message.json', '--format', 'json'], {
    cwd: join(dir, 'package'),
    stdio: 'pipe'
  });

  const invalidProposal = spawnSync('node', ['dist/cli.js', 'plan', 'fixtures/unstructured.md', '--format', 'json'], {
    cwd: join(dir, 'package'),
    encoding: 'utf8'
  });
  if (invalidProposal.status === 0 || invalidProposal.stdout !== '' || !/action or summary/i.test(invalidProposal.stderr)) {
    throw new Error('packed CLI accepted an unstructured Markdown proposal');
  }

  console.log(`package smoke passed for ${tarball}`);
  rmSync(tarball, { force: true });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
