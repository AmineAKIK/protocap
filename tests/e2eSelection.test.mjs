import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);

test('every Playwright spec is selected by a named E2E script wired into CI', async () => {
  const [entries, packageJson, workflow] = await Promise.all([
    readdir(new URL('e2e/', root), { recursive: true, withFileTypes: true }),
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('.github/workflows/ci.yml', root), 'utf8'),
  ]);

  const specs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => relative(rootPath, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
  const e2eScripts = Object.entries(packageJson.scripts)
    .filter(([name, command]) => name.startsWith('test:e2e') && command.includes('playwright test'));

  assert.ok(specs.length > 0, 'the repository must discover at least one Playwright spec');
  assert.ok(e2eScripts.length > 0, 'the repository must define at least one named E2E script');

  for (const spec of specs) {
    const selected = e2eScripts.some(([, command]) => {
      const explicitSpecs = command.match(/e2e\/[\w./-]+\.spec\.ts/g) ?? [];
      return explicitSpecs.length === 0 || explicitSpecs.includes(spec);
    });
    assert.ok(selected, `${spec} is not selected by any test:e2e script`);
  }

  for (const [name] of e2eScripts) {
    assert.match(workflow, new RegExp(`npm run ${name.replaceAll(':', '\\:')}(?:\\s|$)`));
  }
});
