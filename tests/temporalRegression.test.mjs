import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/ExpiryCheckPage.tsx');
const form = read('src/features/expiry/DeclarationForm.tsx');
const workspace = read('src/features/expiry/useExpiryWorkspace.ts');
const time = read('src/features/expiry/time.ts');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

test('PR-03 forbids UTC slicing and connects the real page to the validated declaration path', () => {
  assert.doesNotMatch(page + form, /toISOString\(\)\.slice\(0,\s*16\)/);
  assert.match(form, /formatLocalMinute\(new Date\(\), timeZone\)/);
  assert.match(page, /<DeclarationForm/);
  assert.match(page, /commitExpiryDeclaration\(selectedLine\.id, kind, draft, id\)/);
  assert.match(workspace, /runWithRequiredWebLock\(EXPIRY_LOCK_NAME/);
  assert.match(workspace, /loadExpiryWorkspace\(initialConditioningLines, initialChangeHistory\)/);
  assert.match(workspace, /prepareDeclaration\(latest\.aggregate\.lines, lineId, kind, draft, new Date\(\), operationId\)/);
  assert.doesNotMatch(page, /new Date\(changedAt\)/);
});

test('PR-03 keeps named zones, explicit overlap choices and strict calendar parsing', () => {
  // Behavioral coverage lives in time.test.ts, not in an implementation-specific Intl algorithm.
  assert.match(time, /isNamedTimeZone/);
  assert.match(time, /disambiguation: 'earlier'/);
  assert.match(time, /disambiguation: 'later'/);
  assert.match(time, /overflow: 'reject'/);
  assert.match(time, /fail\('overlap'/);
  assert.match(time, /fail\('gap'/);
  assert.match(time, /calendar-days-v1/);
  assert.doesNotMatch(time, /globalThis\.Temporal\s*=/);
});

test('PR-03 declares and locks the reviewed Temporal adapter instead of importing an undeclared library', () => {
  assert.match(time, /import \{ Temporal \} from '@js-temporal\/polyfill'/);
  assert.equal(pkg.dependencies['@js-temporal/polyfill'], '0.5.1');
  assert.equal(lock.packages[''].dependencies['@js-temporal/polyfill'], '0.5.1');
  const entry = lock.packages['node_modules/@js-temporal/polyfill'];
  assert.equal(entry.version, '0.5.1');
  assert.ok(entry.integrity.startsWith('sha512-'));
  assert.equal(JSON.parse(read('node_modules/@js-temporal/polyfill/package.json')).version, entry.version);
  assert.equal(Object.keys(pkg.dependencies).some((name) => /luxon|moment|date-fns/i.test(name)), false);
});
