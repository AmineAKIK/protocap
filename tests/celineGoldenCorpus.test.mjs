import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const corpusUrl = new URL('../evals/celine-golden.jsonl', import.meta.url);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

test('Céline golden corpus is valid, uniquely identified and covers critical intent families', async () => {
  const raw = await readFile(corpusUrl, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  assert.ok(lines.length >= 10);

  const ids = new Set();
  const intents = new Set();
  for (const [index, line] of lines.entries()) {
    const entry = JSON.parse(line);
    assert.ok(isRecord(entry), `line ${index + 1} must be an object`);
    assert.equal(typeof entry.id, 'string');
    assert.ok(entry.id.length > 0);
    assert.equal(ids.has(entry.id), false, `duplicate id ${entry.id}`);
    ids.add(entry.id);
    assert.ok(isRecord(entry.state), `${entry.id} must define state`);
    assert.equal(typeof entry.message, 'string');
    assert.ok(entry.message.trim().length > 0);
    assert.ok(isRecord(entry.expected), `${entry.id} must define expected output`);
    assert.equal(typeof entry.expected.intent, 'string');
    intents.add(entry.expected.intent);
  }

  for (const required of [
    'conversation',
    'start_workflow',
    'query_procedure',
    'navigate_workflow',
    'lexicon',
    'emergency',
    'unknown',
  ]) {
    assert.equal(intents.has(required), true, `golden corpus missing ${required}`);
  }
});
