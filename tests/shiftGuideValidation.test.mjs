import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidShiftGuideConfig,
  isValidShiftGuideData,
  validateShiftGuideData,
} from '../shared/shiftGuideContract.js';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

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
          id: 'changement_lot',
          title: 'Lot',
          actions: [{ id: 'chl_01', text: 'Changer le lot' }],
        },
      ],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

test('shared ShiftGuide contract accepts the runtime shape used by server and client', () => {
  assert.equal(isValidShiftGuideConfig(validConfig), true);
  assert.equal(isValidShiftGuideData(validConfig), true);
});

test('shared ShiftGuide contract rejects empty action collections', () => {
  const result = validateShiftGuideData({
    ...validConfig,
    modules: [{ id: 'bad', title: 'Bad', description: 'Bad', type: 'standard', actions: [] }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /actions must contain at least one action/);
});

test('shared ShiftGuide contract rejects empty choice collections', () => {
  assert.equal(
    isValidShiftGuideData({
      ...validConfig,
      modules: [{ id: 'bad', title: 'Bad', description: 'Bad', type: 'choice', subModules: [] }],
    }),
    false
  );
});

test('shared ShiftGuide contract rejects globally duplicated action ids', () => {
  const result = validateShiftGuideData({
    ...validConfig,
    modules: [
      { id: 'one', title: 'One', description: '', type: 'standard', actions: [{ id: 'same', text: 'A' }] },
      { id: 'two', title: 'Two', description: '', type: 'standard', actions: [{ id: 'same', text: 'B' }] },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicates action id "same"/);
});

test('shared ShiftGuide contract rejects duplicated module/submodule scope ids', () => {
  assert.equal(
    isValidShiftGuideData({
      ...validConfig,
      modules: [
        { id: 'shared', title: 'One', description: '', type: 'standard', actions: [{ id: 'a1', text: 'A' }] },
        {
          id: 'choice',
          title: 'Choice',
          description: '',
          type: 'choice',
          subModules: [{ id: 'shared', title: 'Sub', actions: [{ id: 'a2', text: 'B' }] }],
        },
      ],
    }),
    false
  );
});

test('shared ShiftGuide contract validates the emergencies payload', () => {
  assert.equal(isValidShiftGuideData({ ...validConfig, urgences: null }), false);
  assert.equal(
    isValidShiftGuideData({
      ...validConfig,
      urgences: { ...DEFAULT_SHIFTGUIDE_URGENCES, generalAlarm: { signal: '', instruction: '', steps: [] } },
    }),
    false
  );
});

test('shared ShiftGuide contract rejects duplicated lexicon sigles case-insensitively', () => {
  assert.equal(
    isValidShiftGuideData({
      ...validConfig,
      lexique: [
        { sigle: 'OC', definition: 'One' },
        { sigle: 'oc', definition: 'Two' },
      ],
    }),
    false
  );
});
