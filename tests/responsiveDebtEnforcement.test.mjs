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

test('shared surface and form primitives remain defined while application pages consume them', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const tsxFiles = await collectFiles(sourceRoot.pathname, '.tsx');
  const source = (await Promise.all(tsxFiles.map((file) => readFile(file, 'utf8')))).join('\n');

  for (const primitive of ['panel', 'label', 'field']) {
    assert.match(source, new RegExp(`className=[^\\n]*\\b${primitive}\\b`), `expected ${primitive} to remain consumed by application pages`);
    assert.match(css, new RegExp(`\\.${primitive}\\s*\\{`), `src/index.css must define the shared .${primitive} primitive`);
  }

  assert.match(css, /\.label\s*\{[\s\S]*?@apply[^;]*\bblock\b[^;]*;/, '.label must stay block-level so labels cannot collapse inline with controls');
  assert.match(css, /\.field\s*\{[\s\S]*?@apply[^;]*\bw-full\b[^;]*\bmin-w-0\b[^;]*;/, '.field must own full-width shrink-safe control geometry');
  assert.match(css, /\.field\s*\{[\s\S]*?@apply[^;]*\bmin-h-11\b[^;]*;/, '.field must preserve the minimum touch target height');
});
