import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCelineSystemPrompt } from '../server/celinePrompt.mjs';

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
  systemPromptExtra: 'Contexte test',
};

test('buildCelineSystemPrompt contains server procedures and mandatory response contract', () => {
  const prompt = buildCelineSystemPrompt(sampleData);

  assert.match(prompt, /Reponds TOUJOURS en JSON valide/);
  assert.match(prompt, /DEBUT POSTE — 2 actions/);
  assert.match(prompt, /1\. Action une/);
  assert.match(prompt, /2\. Action deux \[Important\]/);
  assert.match(prompt, /Note: Fin module/);
  assert.match(prompt, /OC : Ordre de conditionnement/);
  assert.match(prompt, /CONTEXTE SUPPLEMENTAIRE/);
  assert.match(prompt, /Contexte test/);
});

test('buildCelineSystemPrompt omits supplemental section when empty', () => {
  const prompt = buildCelineSystemPrompt({ ...sampleData, systemPromptExtra: '' });
  assert.doesNotMatch(prompt, /CONTEXTE SUPPLEMENTAIRE/);
});
