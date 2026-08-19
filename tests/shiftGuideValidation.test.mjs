import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidShiftGuideConfig } from '../server/shiftGuideValidation.mjs';

const validConfig = {
  modules: [
    {
      id: 'debut_poste',
      title: 'Début poste',
      description: 'Préparer la ligne',
      type: 'standard',
      actions: [{ id: 'dp_01', text: 'Faire le contrôle' }],
    },
    {
      id: 'changement_oc',
      title: 'Changement OC',
      description: 'Choisir le changement',
      type: 'choice',
      subModules: [
        {
          id: 'lot',
          title: 'Lot',
          actions: [{ id: 'chl_01', text: 'Changer le lot' }],
        },
      ],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
};

test('isValidShiftGuideConfig accepts the runtime shape used by ShiftGuide', () => {
  assert.equal(isValidShiftGuideConfig(validConfig), true);
});

test('isValidShiftGuideConfig rejects malformed modules', () => {
  assert.equal(
    isValidShiftGuideConfig({
      ...validConfig,
      modules: [{ id: 'bad', title: 'Bad', description: 'Bad', type: 'standard', actions: [{ text: 'missing id' }] }],
    }),
    false
  );
});

test('isValidShiftGuideConfig rejects malformed lexique entries', () => {
  assert.equal(isValidShiftGuideConfig({ ...validConfig, lexique: [{ sigle: 'OC' }] }), false);
});
