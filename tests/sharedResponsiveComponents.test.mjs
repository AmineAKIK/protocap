import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('shared button labels shrink and wrap at natural boundaries', async () => {
  const button = await read('src/components/Button.tsx');

  assert.match(button, /max-w-full min-w-0/);
  assert.match(button, /whitespace-normal break-normal/);
  assert.match(button, /shrink-0/);
});

test('badges wrap by default and require an explicit atomic nowrap contract', async () => {
  const badge = await read('src/components/Badge.tsx');

  assert.match(badge, /nowrap\?: boolean/);
  assert.match(badge, /nowrap = false/);
  assert.match(badge, /min-w-0 whitespace-normal break-normal/);
  assert.match(badge, /nowrap \? 'shrink-0 whitespace-nowrap'/);
});

test('accessible dialog owns a bounded content scroll region without assuming header height', async () => {
  const dialog = await read('src/components/AccessibleDialog.tsx');

  assert.match(dialog, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(dialog, /min-h-0 overflow-y-auto overscroll-contain/);
  assert.match(dialog, /break-normal text-lg/);
  assert.doesNotMatch(dialog, /100dvh_-_6rem/);
});

test('shared informational surfaces opt out of emergency character breaking', async () => {
  const statCard = await read('src/components/StatCard.tsx');
  const notice = await read('src/components/DemoBoundaryNotice.tsx');

  assert.match(statCard, /min-w-0/);
  assert.match(statCard, /break-normal/);
  assert.match(notice, /min-w-0/);
  assert.match(notice, /break-normal/);
});
