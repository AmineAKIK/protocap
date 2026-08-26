import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendCelineProviderDecision,
  buildCelineProviderHistory,
  extractLatestCelineUserMessage,
} from '../server/celineProviderContext.mjs';

test('provider context extracts only the latest valid operator message', () => {
  assert.equal(extractLatestCelineUserMessage([
    { role: 'user', content: 'ancien' },
    { role: 'assistant', content: '{"message":"ancienne checklist"}' },
    { role: 'user', content: 'courant' },
  ]), 'courant');

  assert.equal(extractLatestCelineUserMessage([{ role: 'assistant', content: 'x' }]), null);
  assert.equal(extractLatestCelineUserMessage([{ role: 'user', content: 'x'.repeat(2_001) }]), null);
});

test('provider context stores only operator turns and provider-compatible closed decisions', () => {
  let context = [];
  context = appendCelineProviderDecision(context, 'Je commence mon poste', {
    kind: 'route',
    id: 'debut_poste_production',
  });

  assert.deepEqual(context, [
    { role: 'user', content: 'Je commence mon poste' },
    { role: 'assistant', content: '{"kind":"route","id":"debut_poste_production"}' },
  ]);
  assert.doesNotMatch(JSON.stringify(context), /checklist|Faire le contrôle|module/i);
});

test('deterministic domain-only decisions do not pollute provider examples', () => {
  const context = [
    { role: 'user', content: 'ancien' },
    { role: 'assistant', content: '{"kind":"route","id":"production"}' },
  ];

  assert.deepEqual(
    appendCelineProviderDecision(context, 'bonjour', { kind: 'conversation', id: 'greeting' }),
    context
  );
  assert.deepEqual(
    appendCelineProviderDecision(context, 'et après ?', { kind: 'navigate', id: 'next' }),
    context
  );
});

test('provider context is bounded to four semantic turns', () => {
  let context = [];
  for (let index = 0; index < 12; index += 1) {
    context = appendCelineProviderDecision(context, `tour-${index}`, {
      kind: 'clarify',
      id: `q-${index}`,
    });
  }

  assert.equal(context.length, 8);
  assert.equal(context[0].content, 'tour-8');
  const history = buildCelineProviderHistory(context, 'nouveau');
  assert.equal(history.length, 9);
  assert.deepEqual(history.at(-1), { role: 'user', content: 'nouveau' });
});
