import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCelineProviderCostGuard,
  measureCelineProviderInput,
} from '../server/celineCostGuard.mjs';

test('Celine cost guard measures provider input without retaining content', () => {
  assert.deepEqual(
    measureCelineProviderInput('abc', [
      { role: 'user', content: 'bonjour' },
      { role: 'assistant', content: '{"kind":"unknown"}' },
    ]),
    {
      systemPromptBytes: 3,
      historyMessages: 2,
      historyChars: 25,
    }
  );
});

test('Celine cost guard rejects oversized prompt and history before provider work', () => {
  const promptGuard = createCelineProviderCostGuard({
    limits: {
      providerCallsPerMinute: 5,
      providerTokensPerHour: 1_000,
      systemPromptMaxBytes: 100,
      historyMaxChars: 100,
    },
  });
  assert.equal(promptGuard.beforeRequest({ systemPrompt: 'x'.repeat(101), history: [] }).reason, 'system_prompt_bytes');
  assert.equal(promptGuard.beforeRequest({
    systemPrompt: 'ok',
    history: [{ role: 'user', content: 'x'.repeat(101) }],
  }).reason, 'history_chars');
});

test('Celine cost guard limits provider call bursts independently from chat traffic', () => {
  let now = 1_000;
  const guard = createCelineProviderCostGuard({
    now: () => now,
    limits: {
      providerCallsPerMinute: 2,
      providerTokensPerHour: 1_000,
      systemPromptMaxBytes: 1_000,
      historyMaxChars: 1_000,
    },
  });
  const input = { systemPrompt: 'prompt', history: [{ role: 'user', content: 'message' }] };

  assert.equal(guard.beforeRequest(input).allowed, true);
  now += 1;
  assert.equal(guard.beforeRequest(input).allowed, true);
  now += 1;
  const blocked = guard.beforeRequest(input);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'minute_calls');
  assert.equal(blocked.retryAfterSeconds, 60);

  now = 61_001;
  assert.equal(guard.beforeRequest(input).allowed, true);
});

test('Celine cost guard blocks new provider work after the rolling hourly token budget', () => {
  let now = 1_000;
  const guard = createCelineProviderCostGuard({
    now: () => now,
    limits: {
      providerCallsPerMinute: 10,
      providerTokensPerHour: 100,
      systemPromptMaxBytes: 1_000,
      historyMaxChars: 1_000,
    },
  });
  const input = { systemPrompt: 'prompt', history: [] };

  assert.equal(guard.beforeRequest(input).allowed, true);
  assert.equal(guard.recordUsage({ totalTokens: 100 }), 100);
  assert.equal(guard.beforeRequest(input).reason, 'hourly_tokens');

  now += 60 * 60 * 1000 + 1;
  assert.equal(guard.beforeRequest(input).allowed, true);
});
