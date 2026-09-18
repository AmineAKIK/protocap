import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('npm check keeps frontend coverage in the repository gate', async () => {
  const packageJson = JSON.parse(await read('package.json'));

  assert.match(packageJson.devDependencies.vitest, /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.devDependencies['@vitest/coverage-v8'], packageJson.devDependencies.vitest);
  assert.equal(packageJson.scripts['test:frontend:coverage'], 'vitest run --coverage');
  assert.match(packageJson.scripts.check, /test:frontend:coverage/);
});

test('Vitest targeted coverage keeps explicit floors and failure evidence', async () => {
  const { default: config } = await import(`../vitest.config.ts?quality=${Date.now()}`);
  const coverage = config.test.coverage;

  assert.equal(coverage.provider, 'v8');
  assert.deepEqual(coverage.reporter, ['text', 'json-summary', 'html', 'lcov']);
  assert.equal(coverage.reportOnFailure, true);
  assert.ok(coverage.include.includes('src/features/shiftguide/celineClient.ts'));
  assert.equal(coverage.thresholds.statements, 60);
  assert.equal(coverage.thresholds.branches, 50);
  assert.equal(coverage.thresholds.functions, 50);
  assert.equal(coverage.thresholds.lines, 60);
});

test('TypeScript source enables targeted type-aware async linting', async () => {
  const config = await read('eslint.config.mjs');

  assert.match(config, /files: \['src\/\*\*\/\*\.\{ts,tsx\}'\]/);
  assert.match(config, /projectService: true/);
  assert.match(config, /'@typescript-eslint\/no-floating-promises': 'error'/);
  assert.match(config, /'@typescript-eslint\/no-misused-promises'/);
});

test('npm lockfile root metadata stays aligned with package metadata', async () => {
  const [packageJson, packageLock] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('package-lock.json').then(JSON.parse),
  ]);

  assert.equal(packageLock.name, packageJson.name);
  assert.equal(packageLock.packages[''].name, packageJson.name);
  assert.deepEqual(packageLock.packages[''].engines, packageJson.engines);
  assert.deepEqual(packageLock.packages[''].dependencies, packageJson.dependencies);
  assert.deepEqual(packageLock.packages[''].devDependencies, packageJson.devDependencies);
});

test('supply-chain policy audits build tooling and production separately without accepting lower-severity findings', async () => {
  const [packageJson, workflow] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('.github/workflows/ci.yml'),
  ]);

  assert.equal(packageJson.scripts['audit:full'], 'npm audit --include=dev --audit-level=low');
  assert.equal(packageJson.scripts['audit:prod'], 'npm audit --omit=dev --audit-level=low');
  assert.deepEqual(packageJson.allowScripts, { 'esbuild@0.25.12': true });
  assert.match(workflow, /run: npm run audit:full\n/);
  assert.match(workflow, /run: npm run audit:prod\n/);
  assert.match(workflow, /git diff --exit-code -- package\.json package-lock\.json/);
  assert.match(workflow, /npm ls vitest @vitest\/coverage-v8 @vitest\/mocker/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});
