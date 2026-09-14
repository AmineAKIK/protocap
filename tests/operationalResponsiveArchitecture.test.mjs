import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('operational sticky controls consume AppShell geometry instead of duplicating offsets', async () => {
  const expiry = await read('src/pages/ExpiryCheckPage.tsx');
  const logistics = await read('src/pages/LogisticsCallPage.tsx');

  assert.match(expiry, /top-\[var\(--app-header-height\)\]/);
  assert.match(logistics, /top-\[var\(--app-header-height\)\]/);
  assert.doesNotMatch(expiry, /top-14|top-\[7\.25rem\]/);
  assert.doesNotMatch(logistics, /top-14/);

  const expirySticky = expiry.match(/\bsticky\b/g) ?? [];
  assert.equal(expirySticky.length, 1, 'Expiry Check should own one sticky layer below AppShell');
});

test('Expiry Check gives horizontal overflow to the line rail and vertical overflow to the document', async () => {
  const expiry = await read('src/pages/ExpiryCheckPage.tsx');

  assert.match(expiry, /max-w-full overflow-x-auto/);
  assert.match(expiry, /flex w-max min-w-full gap-2/);
  assert.doesNotMatch(expiry, /overflow-y-auto/);
  assert.doesNotMatch(expiry, /max-h-56|max-h-72/);
  assert.match(expiry, /min-\[380px\]:grid-cols-2/);
  assert.match(expiry, /xl:grid-cols-2/);
});

test('Logistics Call keeps one-view composition through small laptops before splitting at xl', async () => {
  const logistics = await read('src/pages/LogisticsCallPage.tsx');

  assert.match(logistics, /xl:hidden/);
  assert.match(logistics, /xl:grid-cols-2/);
  assert.match(logistics, /xl:block/);
  assert.doesNotMatch(logistics, /lg:grid-cols-2/);
});

test('operational surfaces explicitly opt ordinary copy out of emergency character breaking', async () => {
  const expiry = await read('src/pages/ExpiryCheckPage.tsx');
  const logistics = await read('src/pages/LogisticsCallPage.tsx');

  assert.match(expiry, /break-normal/);
  assert.match(logistics, /break-normal/);
  assert.match(expiry, /min-w-0/);
  assert.match(logistics, /min-w-0/);
});
