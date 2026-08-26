import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ProtoCap is the canonical product identity across primary surfaces', async () => {
  const [packageJson, indexHtml, viteConfig, appShell, homePage, readme] = await Promise.all([
    read('package.json'),
    read('index.html'),
    read('vite.config.ts'),
    read('src/components/AppShell.tsx'),
    read('src/pages/HomePage.tsx'),
    read('README.md'),
  ]);

  const metadata = JSON.parse(packageJson);
  assert.equal(metadata.name, 'protocap');

  for (const [surface, content] of Object.entries({
    indexHtml,
    viteConfig,
    appShell,
    homePage,
    readme,
  })) {
    assert.match(content, /ProtoCap/, `${surface} must expose the canonical ProtoCap identity`);
    assert.doesNotMatch(content, /LineOps Toolkit/, `${surface} must not expose the retired product name`);
  }
});
