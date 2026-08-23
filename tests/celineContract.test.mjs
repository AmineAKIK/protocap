import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectShiftGuideActions,
  parseCelineAssistantContent,
} from '../shared/celineContract.js';

const modules = [
  {
    id: 'standard',
    title: 'Standard',
    type: 'standard',
    actions: [
      { id: 'a1', text: 'Action canonique 1', note: 'Note canonique' },
      { id: 'a2', text: 'Action canonique 2' },
    ],
  },
  {
    id: 'choice',
    title: 'Choice',
    type: 'choice',
    subModules: [
      { id: 'sub', title: 'Sous-module', actions: [{ id: 'a3', text: 'Action canonique 3' }] },
    ],
  },
];

const actionCatalog = collectShiftGuideActions(modules);

test('Celine contract returns canonical action content instead of trusting provider text', () => {
  const result = parseCelineAssistantContent(JSON.stringify({
    message: 'Contrôle suivant.',
    checklist: [
      { actionId: 'a1', text: 'Texte halluciné', note: 'Note hallucinee', module: 'Faux module' },
    ],
    followUp: 'Dis-moi quand c’est fait.',
  }), actionCatalog);

  assert.deepEqual(result, {
    message: 'Contrôle suivant.',
    checklist: [
      { actionId: 'a1', text: 'Action canonique 1', note: 'Note canonique', module: 'Standard' },
    ],
    followUp: 'Dis-moi quand c’est fait.',
  });
});

test('Celine contract rejects malformed JSON and unknown or duplicated action ids', () => {
  assert.equal(parseCelineAssistantContent('{broken', actionCatalog), null);
  assert.equal(parseCelineAssistantContent(JSON.stringify({
    message: 'x',
    checklist: [{ actionId: 'hallucinated' }],
    followUp: null,
  }), actionCatalog), null);
  assert.equal(parseCelineAssistantContent(JSON.stringify({
    message: 'x',
    checklist: [
      { actionId: 'a1' },
      { actionId: 'a1' },
    ],
    followUp: null,
  }), actionCatalog), null);
});
