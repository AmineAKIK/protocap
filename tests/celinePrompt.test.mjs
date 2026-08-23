import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG_BUDGETS } from '../shared/configBudgets.js';
import { createCelineAuthority } from '../server/celineAuthority.mjs';
import { buildCelineSystemPrompt } from '../server/celinePrompt.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

const sampleData = {
  modules: [
    {
      id: 'm1',
      title: 'Début poste',
      description: 'demo',
      type: 'standard',
      actions: [
        { id: 'dp_01', text: 'Action une' },
        { id: 'dp_02', text: 'Action deux', note: 'Important' },
      ],
      footerNote: 'Fin module',
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: 'Contexte test',
};

const routingSpec = {
  version: 1,
  routes: [
    {
      id: 'debut_poste_test',
      label: 'Début poste',
      decisionGuide: 'Utiliser lorsque le début de poste est confirmé.',
      actionIds: ['dp_01', 'dp_02'],
    },
  ],
  clarifications: [
    {
      id: 'etat_ligne',
      question: 'Quel est l’état de la ligne ?',
      decisionGuide: 'Utiliser si l’état de ligne manque.',
    },
  ],
  classifierRules: ['Le message courant prime sur l’historique.'],
};

function buildPrompt(data = sampleData, routing = routingSpec) {
  const authority = createCelineAuthority(data, routing);
  return buildCelineSystemPrompt(data, authority);
}

test('buildCelineSystemPrompt exposes only routing declared by the server contract', () => {
  const prompt = buildPrompt();

  assert.match(prompt, /FRONTIERE D'AUTORITE/);
  assert.match(prompt, /"kind":"route","id":"\.\.\."/);
  assert.match(prompt, /debut_poste_test: Début poste/);
  assert.match(prompt, /Utiliser lorsque le début de poste est confirmé/);
  assert.match(prompt, /etat_ligne/);
  assert.match(prompt, /Le message courant prime sur l’historique/);
  assert.match(prompt, /SIGLES AUTORISES/);
  assert.match(prompt, /CONTEXTE SITE NON AUTORITATIF/);
  assert.doesNotMatch(prompt, /Action une/);
  assert.doesNotMatch(prompt, /Action deux/);
});

test('buildCelineSystemPrompt does not expose emergency wording for free-form reproduction', () => {
  const customUrgences = {
    ...DEFAULT_SHIFTGUIDE_URGENCES,
    emergencyNumbers: ['112'],
    generalAlarm: {
      signal: 'Signal test',
      instruction: 'Instruction test',
      steps: ['Étape A', 'Étape B'],
    },
  };
  const prompt = buildPrompt({ ...sampleData, urgences: customUrgences });

  assert.match(prompt, /general_alarm/);
  assert.doesNotMatch(prompt, /Signal test/);
  assert.doesNotMatch(prompt, /Étape A/);
  assert.doesNotMatch(prompt, /112/);
});

test('buildCelineSystemPrompt omits supplemental context when empty', () => {
  const prompt = buildPrompt({ ...sampleData, systemPromptExtra: '' });
  assert.doesNotMatch(prompt, /CONTEXTE SITE NON AUTORITATIF/);
});

test('buildCelineSystemPrompt rejects an oversized aggregate UTF-8 prompt', () => {
  const oversizedRouting = {
    ...routingSpec,
    routes: [{
      ...routingSpec.routes[0],
      decisionGuide: 'é'.repeat(CONFIG_BUDGETS.celineSystemPromptBytes),
    }],
  };
  assert.throws(
    () => buildPrompt(sampleData, oversizedRouting),
    new RegExp(`exceeds ${CONFIG_BUDGETS.celineSystemPromptBytes} UTF-8 bytes`)
  );
});
