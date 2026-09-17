import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/ExpiryCheckPage.tsx', import.meta.url), 'utf8');
const form = readFileSync(new URL('../src/features/expiry/DeclarationForm.tsx', import.meta.url), 'utf8');
const time = readFileSync(new URL('../src/features/expiry/time.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('PR-03 does not reintroduce UTC slicing into datetime-local inputs', () => {
  assert.doesNotMatch(page, /toISOString\(\)\.slice\(0,\s*16\)/);
  assert.doesNotMatch(form, /toISOString\(\)\.slice\(0,\s*16\)/);
  assert.match(form, /formatLocalMinute\(new Date\(\), timeZone\)/);
});

test('PR-03 keeps an explicit IANA zone and disambiguation boundary', () => {
  assert.match(time, /formatToParts/);
  assert.match(time, /getTimezoneOffset/);
  assert.match(time, /code: 'overlap'/);
  assert.match(time, /code: 'gap'/);
  assert.match(time, /calendar-days-v1/);
});

test('PR-03 uses platform Intl only and adds no date/time dependency', () => {
  const dependencies = Object.keys(pkg.dependencies ?? {});
  assert.equal(dependencies.some((name) => /temporal|luxon|moment|date-fns/i.test(name)), false);
});
