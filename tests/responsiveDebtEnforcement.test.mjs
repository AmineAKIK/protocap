import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = new URL('../', import.meta.url);
const sourceRoot = new URL('../src/', import.meta.url);

async function collectFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(entryPath);
  }
  return files;
}

test('source CSS cannot reintroduce arbitrary character wrapping as a responsive fallback', async () => {
  const cssFiles = await collectFiles(sourceRoot.pathname, '.css');
  const offenders = [];
  for (const file of cssFiles) {
    const css = await readFile(file, 'utf8');
    if (/overflow-wrap:\s*anywhere/i.test(css)) offenders.push(path.relative(repositoryRoot.pathname, file));
  }
  assert.deepEqual(offenders, []);
});

test('global and shell styles cannot hide document horizontal overflow', async () => {
  for (const relativePath of ['src/index.css', 'src/responsive-shell.css']) {
    const css = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /overflow-x:\s*hidden/i, `${relativePath} must not clip root horizontal overflow`);
  }
});

test('TSX cannot hide horizontal overflow without an explicit responsive exception marker', async () => {
  const tsxFiles = await collectFiles(sourceRoot.pathname, '.tsx');
  const offenders = [];
  for (const file of tsxFiles) {
    const source = await readFile(file, 'utf8');
    if (source.includes('overflow-x-hidden') && !source.includes('data-responsive-overflow-exception')) {
      offenders.push(path.relative(repositoryRoot.pathname, file));
    }
  }
  assert.deepEqual(offenders, [], 'use local overflow ownership or document an explicit exception instead of clipping x-overflow');
});
