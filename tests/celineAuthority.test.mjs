import assert from 'node:assert/strict';
import test from 'node:test';
import { createCelineAuthority, resolveCelineDecision } from '../server/celineAuthority.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

const config = {
  modules: [
    {
      id: 'module_standard',
      title: 'Module standard',
      description: 'Test',
      type: 'standard',
      actions: [
        { id: 'action_1', text: 'Faire le contrôle', note: 'Note officielle' },
        { id: 'action_2', text: 'Tracer le résultat' },
      ],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: {
    ...DEFAULT_SHIFTGUIDE_URGENCES,
    emergencyNumbers: ['112'],
    generalAlarm: {
      signal: 'Signal officiel',
      instruction: 'Instruction officielle',
      steps: ['Étape A', 'Étape B'],
    },
  },
  systemPromptExtra: 'Texte libre non autoritatif',
};

const routingSpec = {
  version: 1,
  routes: [
    {
      id: 'standard_flow',
      label: 'Module standard',
      decisionGuide: 'Utiliser pour le scénario standard.',
      actionIds: ['action_1', 'action_2'],
    },
  ],
  clarifications: [
    {
      id: 'clarifier_situation',
      question: 'Peux-tu préciser la situation ?',
      decisionGuide: 'Utiliser si la situation est ambiguë.',
    },
  ],
  classifierRules: ['Ne jamais supposer un état absent.'],
};

const authority = createCelineAuthority(config, routingSpec);

test('route decisions render only canonical configured procedure content', () => {
  assert.deepEqual(resolveCelineDecision(authority, { kind: 'route', id: 'standard_flow' }), {
    message: 'Suis la séquence « Module standard » dans l’ordre indiqué.',
    checklist: [
      {
        actionId: 'action_1',
        text: 'Faire le contrôle',
        note: 'Note officielle',
        module: 'Module standard',
      },
      {
        actionId: 'action_2',
        text: 'Tracer le résultat',
        note: null,
        module: 'Module standard',
      },
    ],
    followUp: 'Dis-moi quand la checklist est traitée.',
  });
});

test('clarification, lexicon and emergency decisions render server-owned text', () => {
  assert.deepEqual(resolveCelineDecision(authority, { kind: 'clarify', id: 'clarifier_situation' }), {
    message: 'Peux-tu préciser la situation ?',
    checklist: [],
    followUp: null,
  });
  assert.deepEqual(resolveCelineDecision(authority, { kind: 'lexicon', id: 'oc' }), {
    message: 'OC : Ordre de conditionnement',
    checklist: [],
    followUp: null,
  });
  assert.deepEqual(resolveCelineDecision(authority, { kind: 'emergency', id: 'general_alarm' }), {
    message: 'Signal officiel. Instruction officielle Étapes : Étape A → Étape B.',
    checklist: [],
    followUp: null,
  });
});

test('unknown and unauthorized decisions fail closed', () => {
  assert.deepEqual(resolveCelineDecision(authority, { kind: 'unknown' }), {
    message: 'Je n’ai pas cette information dans le référentiel ShiftGuide. Vois avec ton responsable.',
    checklist: [],
    followUp: null,
  });
  assert.equal(resolveCelineDecision(authority, { kind: 'route', id: 'route_inventee' }), null);
  assert.equal(resolveCelineDecision(authority, { kind: 'clarify', id: 'question_inventee' }), null);
  assert.equal(resolveCelineDecision(authority, { kind: 'lexicon', id: 'INCONNU' }), null);
  assert.equal(resolveCelineDecision(authority, { kind: 'emergency', id: 'invented' }), null);
});
