import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCelineDecision } from '../shared/celineContract.js';

test('Celine provider contract accepts closed decisions and normalizes untrusted extra fields away', () => {
  assert.deepEqual(
    parseCelineDecision(JSON.stringify({ kind: 'route', id: 'debut_oc' })),
    { kind: 'route', id: 'debut_oc' }
  );
  assert.deepEqual(
    parseCelineDecision(JSON.stringify({ kind: 'clarify', id: 'debut_oc_precedent' })),
    { kind: 'clarify', id: 'debut_oc_precedent' }
  );
  assert.deepEqual(
    parseCelineDecision(JSON.stringify({ kind: 'lexicon', id: 'OC' })),
    { kind: 'lexicon', id: 'OC' }
  );
  assert.deepEqual(
    parseCelineDecision(JSON.stringify({ kind: 'emergency', id: 'general_alarm' })),
    { kind: 'emergency', id: 'general_alarm' }
  );
  assert.deepEqual(parseCelineDecision(JSON.stringify({ kind: 'unknown' })), { kind: 'unknown' });
  assert.deepEqual(
    parseCelineDecision(JSON.stringify({
      kind: 'route',
      id: 'debut_oc',
      message: 'Instruction libre qui ne doit jamais traverser la frontière',
      reason: 'explication fournisseur',
    })),
    { kind: 'route', id: 'debut_oc' }
  );
  assert.deepEqual(
    parseCelineDecision(JSON.stringify({ kind: 'unknown', reason: 'texte libre' })),
    { kind: 'unknown' }
  );
});

test('Celine provider contract still rejects malformed or unknown decisions', () => {
  assert.equal(parseCelineDecision('{broken'), null);
  assert.equal(parseCelineDecision(JSON.stringify({ kind: 'route' })), null);
  assert.equal(parseCelineDecision(JSON.stringify({ kind: 'route', id: '' })), null);
  assert.equal(parseCelineDecision(JSON.stringify({ kind: 'invented', id: 'x' })), null);
});
