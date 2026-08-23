import assert from 'node:assert/strict';
import test from 'node:test';
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

function buildPrompt(data = sampleData) {
  const authority = createCelineAuthority(data);
  return buildCelineSystemPrompt(data, authority);
}

test('buildCelineSystemPrompt exposes only closed server-owned decisions', () => {
  const prompt = buildPrompt();

  assert.match(prompt, /FRONTIERE D'AUTORITE/);
  assert.match(prompt, /"kind":"route","id":"\.\.\."/);
  assert.match(prompt, /module:m1: Début poste/);
  assert.match(prompt, /debut_oc_precedent/);
  assert.match(prompt, /SIGLES AUTORISES/);
  assert.match(prompt, /OC/);
  assert.match(prompt, /CONTEXTE SITE NON AUTORITATIF/);
  assert.match(prompt, /Contexte test/);
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
  assert.match(prompt, /accident/);
  assert.doesNotMatch(prompt, /Signal test/);
  assert.doesNotMatch(prompt, /Étape A/);
  assert.doesNotMatch(prompt, /112/);
});

test('buildCelineSystemPrompt omits supplemental context when empty', () => {
  const prompt = buildPrompt({ ...sampleData, systemPromptExtra: '' });
  assert.doesNotMatch(prompt, /CONTEXTE SITE NON AUTORITATIF/);
});
