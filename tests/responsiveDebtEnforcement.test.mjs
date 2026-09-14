import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = new URL('../', import.meta.url);
const sourceRoot = new URL('../src/', import.meta.url);

async function collectCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectCssFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(entryPath);
    }
  }

  return files;
}

test('source CSS cannot reintroduce arbitrary character wrapping as a responsive fallback', async () => {
  const cssFiles = await collectCssFiles(sourceRoot.pathname);
  const offenders = [];

  for (const file of cssFiles) {
    const css = await readFile(file, 'utf8');
    if (/overflow-wrap:\s*anywhere/i.test(css)) {
      offenders.push(path.relative(repositoryRoot.pathname, file));
    }
  }

  assert.deepEqual(offenders, []);
});

test('global and shell styles cannot hide document horizontal overflow', async () => {
  const globalStyles = ['src/index.css', 'src/responsive-shell.css'];

  for (const relativePath of globalStyles) {
    const css = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /overflow-x:\s*hidden/i, `${relativePath} must not clip root horizontal overflow`);
  }
});
