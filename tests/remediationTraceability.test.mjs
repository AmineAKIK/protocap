import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function requireIdentifiers(content, prefix, count) {
  for (let index = 1; index <= count; index += 1) {
    const identifier = `${prefix}${String(index).padStart(2, '0')}`;
    assert.match(content, new RegExp(`\\b${identifier}\\b`), `${identifier} is missing`);
  }
}

test('remediation contract routes every decision, PR, finding and acceptance test', async () => {
  const plan = await read('docs/remediation-plan.md');

  requireIdentifiers(plan, 'D', 8);
  requireIdentifiers(plan, 'PR-', 13);
  requireIdentifiers(plan, 'F', 24);
  requireIdentifiers(plan, 'T', 45);

  const findingRows = plan.split('\n').filter((line) => /^\| F\d{2} \|/.test(line));
  assert.equal(findingRows.length, 24);
  for (const row of findingRows) {
    assert.match(row, /\| (?:Ouvert|En cours|Implémenté|Vérifié|Livré|Bloqué)(?: |—|\|)/);
  }
  assert.doesNotMatch(findingRows.join('\n'), /\| (?:Corrigé|Clos)(?: |—|\|)/);
});

test('PR-01 baseline records the real parent, Node 24 execution and explicit blockers', async () => {
  const baseline = await read('docs/remediation-baseline.md');

  assert.match(baseline, /e5adec6d7c656a9dd63cea2a6db2509b23dbdf10/);
  assert.match(baseline, /Node v24\.19\.0/);
  assert.match(baseline, /`npm run check` \| Succès/);
  assert.match(baseline, /CLI Docker absente/);
  assert.match(baseline, /Suites Playwright locales \| Non exécutées/);
  assert.match(baseline, /T29/);
  assert.match(baseline, /T31/);
  assert.match(baseline, /T38/);
  assert.match(baseline, /T39/);
});

test('pull request template requires traceability, red-green proof, migration and rollback', async () => {
  const template = await read('.github/pull_request_template.md');

  for (const field of [
    'Plan identifier:',
    'Parent SHA:',
    'Finding(s) addressed:',
    'Invariant(s) preserved:',
    'Parent evidence:',
    'Corrected evidence:',
    'Migration:',
    'Recovery:',
    'Rollback exercised:',
    'Elements not executed:',
  ]) {
    assert.match(template, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
