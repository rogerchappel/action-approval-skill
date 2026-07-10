import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const failures = [];

function requireField(condition, message) {
  if (!condition) failures.push(message);
}

requireField(pkg.name === 'action-approval-skill', 'package name must remain action-approval-skill');
requireField(pkg.version === '0.1.0', 'release candidate version must be 0.1.0');
requireField(pkg.license === 'MIT', 'package must declare the MIT license');
requireField(pkg.engines?.node === '>=20', 'Node engine must document the TypeScript runtime baseline');
requireField(pkg.repository?.url === 'git+https://github.com/rogerchappel/action-approval-skill.git', 'repository metadata must point at GitHub');
requireField(pkg.bugs?.url === 'https://github.com/rogerchappel/action-approval-skill/issues', 'bugs URL must point at GitHub issues');
requireField(pkg.homepage === 'https://github.com/rogerchappel/action-approval-skill#readme', 'homepage must point at the README');
requireField(pkg.bin?.['action-approval-skill'] === 'dist/cli.js', 'CLI bin must point at dist/cli.js');
requireField(pkg.exports?.['.'] === './dist/index.js', 'package export must point at dist/index.js');
requireField(Array.isArray(pkg.files), 'package files allowlist is required');

for (const file of [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'SKILL.md',
  'docs/VERIFICATION.md',
  'docs/RELEASE_CANDIDATE.md',
  'fixtures/slack-message.json',
  'fixtures/repository-push.json',
  '.github/workflows/ci.yml'
]) {
  requireField(existsSync(file), `${file} must be present for release review`);
}

for (const entry of ['dist', 'SKILL.md', 'scripts/validate-release-readiness.mjs', 'docs', 'fixtures', 'README.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md']) {
  requireField(pkg.files.includes(entry), `package files allowlist must include ${entry}`);
}

if (failures.length) {
  console.error(`release readiness failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('release readiness ok');
