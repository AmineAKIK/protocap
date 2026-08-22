import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectShiftGuideActionIds,
  parseCelineAssistantContent,
} from '../shared/celineContract.js';

const modules = [
  {
    id: 'standard',
    type: 'standard',
    actions: [{ id: 'a1' }, { id: 'a2' }],
  },
  {
    id: 'choice',
    type: 'choice',
    subModules: [
      { id: 'sub', actions: [{ id: 'a3' }] },
    ],
  },
];

const allowed = collectShiftGuideActionIds(modules);

test('Celine contract returns a Protocap-owned DTO for valid provider content', () => {
  const result = parseCelineAssistantContent(JSON.stringify({
    message: 'Contrôle suivant.',
    checklist: [
      { actionId: 'a1', text: 'Faire le contrôle', note: null, module: 'Standard' },
    ],
    followUp: 'Dis-moi quand c’est fait.',
  }), allowed);

  assert.deepEqual(result, {
    message: 'Contrôle suivant.',
    checklist: [
      { actionId: 'a1', text: 'Faire le contrôle', note: null, module: 'Standard' },
    ],
    followUp: 'Dis-moi quand c’est fait.',
  });
});

test('Celine contract rejects malformed JSON and unknown or duplicated action ids', () => {
  assert.equal(parseCelineAssistantContent('{broken', allowed), null);
  assert.equal(parseCelineAssistantContent(JSON.stringify({
    message: 'x',
    checklist: [{ actionId: 'hallucinated', text: 'x', note: null, module: null }],
    followUp: null,
  }), allowed), null);
  assert.equal(parseCelineAssistantContent(JSON.stringify({
    message: 'x',
    checklist: [
      { actionId: 'a1', text: 'x', note: null, module: null },
      { actionId: 'a1', text: 'y', note: null, module: null },
    ],
    followUp: null,
  }), allowed), null);
});
