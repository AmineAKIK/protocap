import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('pilot responsive behavior is expressed by explicit composition instead of structural CSS selectors', async () => {
  const page = await read('src/pages/PilotProposalPage.tsx');
  const css = await read('src/pilot-responsive.css');

  assert.match(page, /min-\[1200px\]:grid-cols-/);
  assert.match(page, /pilot-reminder-context/);
  assert.match(page, /pilot-inline-flow/);
  assert.match(page, /pilot-summary-grid/);
  assert.match(page, /min-\[1200px\]:min-h-\[1385px\]/);

  assert.doesNotMatch(css, /\.grid\.sm\\:grid-cols-3/);
  assert.doesNotMatch(css, /rounded-xl\.border\.border-slate-200\.p-6/);
  assert.doesNotMatch(css, /\[class\*="min-h-\[78px\]"\]/);
  assert.doesNotMatch(css, /\[class\*="min-h-\[1385px\]"\]/);
  assert.doesNotMatch(css, /> div > div > section/);
});

test('pilot keeps local horizontal overflow explicit without route-wide wrapping overrides', async () => {
  const page = await read('src/pages/PilotProposalPage.tsx');
  const css = await read('src/pilot-responsive.css');

  assert.match(page, /max-w-full overflow-x-auto/);
  assert.match(page, /min-w-\[820px\]/);
  assert.doesNotMatch(css, /overflow-wrap:/);
  assert.doesNotMatch(css, /word-break:/);
  assert.match(css, /white-space:\s*nowrap/);
});
