import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG_BUDGETS } from '../shared/configBudgets.js';
import {
  isValidShiftGuideConfig,
  isValidShiftGuideData,
  validateShiftGuideConfig,
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

test('ShiftGuide budgets reject excessive cardinality and field length', () => {
  const tooManyModules = Array.from({ length: CONFIG_BUDGETS.modules + 1 }, (_, index) => ({
    id: `m${index}`,
    title: `Module ${index}`,
    description: '',
    type: 'standard',
    actions: [{ id: `a${index}`, text: 'Action' }],
  }));
  const cardinality = validateShiftGuideData({ ...validConfig, modules: tooManyModules });
  assert.equal(cardinality.ok, false);
  assert.match(cardinality.errors.join('\n'), new RegExp(`modules must contain at most ${CONFIG_BUDGETS.modules} entries`));

  const oversizedText = validateShiftGuideData({
    ...validConfig,
    modules: [{ ...validConfig.modules[0], actions: [{ id: 'a-long', text: 'x'.repeat(CONFIG_BUDGETS.textChars + 1) }] }],
  });
  assert.equal(oversizedText.ok, false);
  assert.match(oversizedText.errors.join('\n'), new RegExp(`at most ${CONFIG_BUDGETS.textChars} characters`));
});

test('ShiftGuide budgets bound total actions across otherwise valid scopes', () => {
  const moduleCount = Math.floor(CONFIG_BUDGETS.totalActions / CONFIG_BUDGETS.actionsPerScope) + 1;
  const modules = Array.from({ length: moduleCount }, (_, moduleIndex) => ({
    id: `m${moduleIndex}`,
    title: `Module ${moduleIndex}`,
    description: '',
    type: 'standard',
    actions: Array.from({ length: CONFIG_BUDGETS.actionsPerScope }, (_, actionIndex) => ({
      id: `m${moduleIndex}_a${actionIndex}`,
      text: 'Action',
    })),
  }));
  assert.ok(moduleCount <= CONFIG_BUDGETS.modules);
  const result = validateShiftGuideData({ ...validConfig, modules });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), new RegExp(`at most ${CONFIG_BUDGETS.totalActions} actions in total`));
});

test('ShiftGuide config bounds supplemental Celine context', () => {
  const result = validateShiftGuideConfig({
    ...validConfig,
    systemPromptExtra: 'x'.repeat(CONFIG_BUDGETS.systemPromptExtraChars + 1),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), new RegExp(`at most ${CONFIG_BUDGETS.systemPromptExtraChars} characters`));
});
