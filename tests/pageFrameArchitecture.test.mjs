import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('PageFrame owns standard application widths and gutters', async () => {
  const frame = await read('src/components/PageFrame.tsx');

  assert.match(frame, /standard: 'max-w-7xl'/);
  assert.match(frame, /wide: 'max-w-\[1500px\]'/);
  assert.match(frame, /standard: 'px-4 sm:px-6 lg:px-8'/);
  assert.match(frame, /compact: 'px-3 sm:px-6 lg:px-8'/);
  assert.match(frame, /mx-auto w-full min-w-0/);
});

test('public shell and shared notices consume PageFrame instead of duplicating frame geometry', async () => {
  const shell = await read('src/components/AppShell.tsx');
  const notice = await read('src/components/DemoBoundaryNotice.tsx');

  assert.match(shell, /import \{ PageFrame \} from '\.\/PageFrame'/);
  assert.match(shell, /<PageFrame className="app-shell-header-inner/);
  assert.doesNotMatch(shell, /mx-auto grid max-w-7xl/);

  assert.match(notice, /import \{ PageFrame \} from '\.\/PageFrame'/);
  assert.match(notice, /<PageFrame className="flex flex-col/);
  assert.doesNotMatch(notice, /mx-auto flex max-w-7xl/);
});

test('migrated standard public pages no longer own application frame geometry', async () => {
  const home = await read('src/pages/HomePage.tsx');
  const knowledge = await read('src/pages/KnowledgeBasePage.tsx');

  assert.match(home, /import \{ PageFrame \} from '\.\.\/components\/PageFrame'/);
  assert.doesNotMatch(home, /mx-auto max-w-7xl px-4/);

  assert.match(knowledge, /import \{ PageFrame \} from '\.\.\/components\/PageFrame'/);
  assert.doesNotMatch(knowledge, /mx-auto max-w-7xl px-3/);
  assert.match(knowledge, /<PageFrame gutter="compact"/);
});
