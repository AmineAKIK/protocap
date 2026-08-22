import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCelineSystemPrompt } from '../server/celinePrompt.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

const sampleData = {
  modules: [
    {
      id: 'm1',
      title: 'Debut poste',
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

test('buildCelineSystemPrompt contains server procedures and mandatory response contract', () => {
  const prompt = buildCelineSystemPrompt(sampleData);

  assert.match(prompt, /Reponds TOUJOURS en JSON valide/);
  assert.match(prompt, /"actionId":"dp_01"/);
  assert.match(prompt, /actionId.*OBLIGATOIRE/);
  assert.match(prompt, /DEBUT POSTE — 2 actions/);
  assert.match(prompt, /1\. \[dp_01\] Action une/);
  assert.match(prompt, /2\. \[dp_02\] Action deux \[Important\]/);
  assert.match(prompt, /Note: Fin module/);
  assert.match(prompt, /OC : Ordre de conditionnement/);
  assert.match(prompt, /CONTEXTE SUPPLEMENTAIRE/);
  assert.match(prompt, /Contexte test/);
});

test('buildCelineSystemPrompt derives emergency guidance from the typed runtime payload', () => {
  const customUrgences = {
    ...DEFAULT_SHIFTGUIDE_URGENCES,
    emergencyNumbers: ['112'],
    generalAlarm: {
      signal: 'Signal test',
      instruction: 'Instruction test',
      steps: ['Étape A', 'Étape B'],
    },
    goldenRules: [{ id: 'test', label: 'Règle test', description: 'Description test' }],
  };
  const prompt = buildCelineSystemPrompt({ ...sampleData, urgences: customUrgences });

  assert.match(prompt, /Numeros : 112/);
  assert.match(prompt, /Signal test — Instruction test/);
  assert.match(prompt, /Étape A -> Étape B/);
  assert.match(prompt, /RÈGLE TEST — Description test/i);
  assert.doesNotMatch(prompt, /Numeros : 15 ou 18/);
});

test('buildCelineSystemPrompt omits supplemental section when empty', () => {
  const prompt = buildCelineSystemPrompt({ ...sampleData, systemPromptExtra: '' });
  assert.doesNotMatch(prompt, /CONTEXTE SUPPLEMENTAIRE/);
});
