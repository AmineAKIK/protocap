import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('T30/T31: global reporting cannot replace or weaken the targeted coverage gate', async () => {
  const [{ default: targeted }, { default: global }] = await Promise.all([
    import(`../vitest.config.ts?targeted=${Date.now()}`),
    import(`../vitest.global.config.ts?global=${Date.now()}`),
  ]);

  assert.deepEqual(targeted.test.coverage.thresholds, {
    statements: 60,
    branches: 50,
    functions: 50,
    lines: 60,
    'src/features/shiftguide/demoRuntime.ts': {
      statements: 90,
      branches: 85,
      functions: 85,
      lines: 90,
    },
    'src/features/logistics/logisticsModel.ts': {
      statements: 90,
      branches: 85,
      functions: 85,
      lines: 90,
    },
  });
  assert.equal(targeted.test.coverage.reportsDirectory, 'coverage/frontend-targeted');
  assert.ok(targeted.test.coverage.include.includes('src/features/shiftguide/demoRuntime.ts'));

  assert.equal(global.test.coverage.reportsDirectory, 'coverage/frontend-global');
  assert.deepEqual(global.test.coverage.include, ['src/**/*.{ts,tsx}']);
  assert.deepEqual(global.test.coverage.exclude, [
    'src/**/*.test.{ts,tsx}',
    'src/test/**',
    'src/types/**',
    'src/**/*.d.ts',
  ]);
  assert.equal(global.test.coverage.thresholds, undefined);
});

test('T30/T38/T39: check:ci produces separate evidence and runs the built container', async () => {
  const [manifest, workflow, codeql] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('.github/workflows/ci.yml'),
    read('.github/workflows/codeql.yml'),
  ]);

  assert.equal(
    manifest.scripts['check:ci'],
    'npm run check && npm run test:frontend:coverage:global && npm run test:server:coverage && npm run test:mutation:smoke',
  );
  assert.match(manifest.scripts['check:server'], /scripts\/container-runtime-smoke\.mjs/);
  assert.match(workflow, /^name: Quality gate$/m);
  assert.match(workflow, /run: npm run check:ci/);
  assert.match(workflow, /run: node scripts\/container-runtime-smoke\.mjs protocap-ci/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  for (const path of [
    'coverage/frontend-targeted',
    'coverage/frontend-global',
    'coverage/server',
    'playwright-report',
    'test-results',
  ]) assert.match(workflow, new RegExp(`^\\s+${path.replaceAll('/', '\\/')}$`, 'm'));

  assert.match(codeql, /^name: CodeQL$/m);
  assert.match(codeql, /name: CodeQL JavaScript\/TypeScript/);
});

test('T31: mutation smoke remains temporary, targeted and fail-closed', async () => {
  const script = await read('scripts/mutation-smoke.mjs');
  for (const target of [
    'src/features/logistics/logisticsModel.ts',
    'src/features/expiry/time.ts',
    'src/features/logistics/logisticsPersistence.ts',
  ]) assert.match(script, new RegExp(target.replaceAll('/', '\\/')));
  assert.match(script, /finally \{\n\s+await writeFile\(mutation\.file, original, 'utf8'\);/);
  assert.match(script, /Critical mutation survived/);
});
