import assert from 'node:assert/strict';
import test from 'node:test';
import { createShiftGuideConfigRevision } from '../server/shiftGuideRevision.mjs';

const baseConfig = {
  modules: [
    {
      id: 'm1',
      title: 'Module',
      description: 'Description',
      type: 'standard',
      actions: [{ id: 'a1', text: 'Contrôler la pression' }],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: {
    emergencyNumbers: ['112'],
    generalAlarm: { signal: 'signal', instruction: 'sortir', steps: ['stop'] },
    drill: { schedule: 'mensuel', instruction: 'suivre' },
    accidentSteps: [{ id: 'acc1', label: 'Alerter', description: 'Prévenir' }],
    goldenRules: [{ id: 'rule1', label: 'Stop', description: 'Arrêter' }],
    priorityMessage: 'Sécurité',
    priorityDescription: 'Priorité absolue',
  },
  systemPromptExtra: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('config revision is deterministic and independent from object key insertion order', () => {
  const reordered = {
    systemPromptExtra: null,
    urgences: baseConfig.urgences,
    lexique: baseConfig.lexique,
    modules: baseConfig.modules,
  };

  const first = createShiftGuideConfigRevision(baseConfig);
  const second = createShiftGuideConfigRevision(reordered);

  assert.match(first, /^sha256:[a-f0-9]{64}$/);
  assert.equal(second, first);
});

test('config revision ignores unknown non-semantic fields at every nested level', () => {
  const decorated = clone(baseConfig);
  decorated.deploymentNote = 'metadata only';
  decorated.modules[0].owner = 'metadata only';
  decorated.modules[0].actions[0].source = 'metadata only';
  decorated.lexique[0].source = 'metadata only';
  decorated.urgences.owner = 'metadata only';
  decorated.urgences.generalAlarm.source = 'metadata only';

  assert.equal(
    createShiftGuideConfigRevision(decorated),
    createShiftGuideConfigRevision(baseConfig)
  );
});

test('config revision changes when operational procedure text changes without changing ids', () => {
  const changed = clone(baseConfig);
  changed.modules[0].actions[0].text = 'Contrôler la pression et consigner la valeur';

  assert.notEqual(
    createShiftGuideConfigRevision(changed),
    createShiftGuideConfigRevision(baseConfig)
  );
});

test('config revision covers lexicon, urgency guidance and Celine config context', () => {
  const lexiconChanged = clone(baseConfig);
  lexiconChanged.lexique[0].definition = 'Ordre de fabrication';

  const urgencyChanged = clone(baseConfig);
  urgencyChanged.urgences.priorityDescription = 'Évacuer immédiatement';

  const promptChanged = clone(baseConfig);
  promptChanged.systemPromptExtra = 'Contexte site révisé';

  const baseRevision = createShiftGuideConfigRevision(baseConfig);
  assert.notEqual(createShiftGuideConfigRevision(lexiconChanged), baseRevision);
  assert.notEqual(createShiftGuideConfigRevision(urgencyChanged), baseRevision);
  assert.notEqual(createShiftGuideConfigRevision(promptChanged), baseRevision);
});
