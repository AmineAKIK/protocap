import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { E2E_SUITES, playwrightArguments } from '../scripts/e2e-suites.mjs';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('T38: every Playwright spec belongs to a named non-empty suite wired into package scripts and CI', async () => {
  const [entries, packageJson, workflow] = await Promise.all([
    readdir(new URL('e2e/', root), { recursive: true, withFileTypes: true }),
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('.github/workflows/ci.yml', root), 'utf8'),
  ]);

  const discoveredSpecs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => relative(rootPath, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
  const selectedSpecs = [];

  assert.ok(discoveredSpecs.length > 0, 'the repository must discover at least one Playwright spec');
  assert.ok(Object.keys(E2E_SUITES).length > 0, 'the E2E manifest must define at least one suite');

  for (const [suiteName, suite] of Object.entries(E2E_SUITES)) {
    assert.ok(suite.specs.length > 0, `${suiteName} must select at least one spec`);
    assert.ok(suite.projects.length > 0, `${suiteName} must select at least one browser project`);
    await access(new URL(suite.config, root));

    for (const spec of suite.specs) {
      await access(new URL(spec, root));
      selectedSpecs.push(spec);
    }

    assert.equal(
      packageJson.scripts[suite.script],
      `node scripts/run-e2e-suite.mjs ${suiteName}`,
      `${suite.script} must delegate to the reviewed suite manifest`,
    );
    assert.match(
      workflow,
      new RegExp(`run: npm run ${escapeRegex(suite.script)}(?:\\s|$)`),
      `${suite.script} must run in the Quality gate`,
    );

    const listedArgs = playwrightArguments(suiteName, { list: true });
    assert.ok(listedArgs.includes('--list'), `${suiteName} must support an explicit discovery preflight`);
    for (const spec of suite.specs) assert.ok(listedArgs.includes(spec));
  }

  assert.deepEqual(
    [...new Set(selectedSpecs)].sort(),
    discoveredSpecs,
    'every E2E spec must be selected by the central manifest',
  );
});
