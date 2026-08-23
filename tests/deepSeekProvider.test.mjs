import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CelineProviderError,
  createDeepSeekProvider,
} from '../server/providers/deepSeekProvider.mjs';

test('DeepSeek adapter owns provider request shape and returns only assistant content', async () => {
  let captured;
  const provider = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '{"message":"ok","checklist":[],"followUp":null}' } }] };
        },
      };
    },
  });

  const content = await provider.complete({
    systemPrompt: 'system',
    history: [{ role: 'user', content: 'bonjour' }],
  });

  assert.equal(content, '{"message":"ok","checklist":[],"followUp":null}');
  assert.equal(captured.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, 'deepseek-v4-flash');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.max_tokens, 4_000);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'bonjour' },
  ]);
});

test('DeepSeek adapter maps upstream rate limits and invalid payloads to provider errors', async () => {
  const rateLimited = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(
    () => rateLimited.complete({ systemPrompt: 'x', history: [] }),
    (error) => error instanceof CelineProviderError && error.code === 'rate_limited'
  );

  const malformed = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async () => ({ ok: true, async json() { return { choices: [] }; } }),
  });
  await assert.rejects(
    () => malformed.complete({ systemPrompt: 'x', history: [] }),
    (error) => error instanceof CelineProviderError && error.code === 'invalid_response'
  );
});

test('DeepSeek adapter propagates client cancellation separately from timeout', async () => {
  let capturedSignal;
  const provider = createDeepSeekProvider({
    apiKey: 'secret',
    timeoutMs: 60_000,
    fetchImpl: async (_url, options) => {
      capturedSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    },
  });
  const controller = new AbortController();

  const request = provider.complete({
    systemPrompt: 'system',
    history: [],
    signal: controller.signal,
  });
  controller.abort(new Error('client gone'));

  await assert.rejects(
    () => request,
    (error) => error instanceof CelineProviderError && error.code === 'cancelled'
  );
  assert.equal(capturedSignal.aborted, true);
});

test('DeepSeek adapter keeps its own timeout semantics when no client cancellation occurs', async () => {
  const provider = createDeepSeekProvider({
    apiKey: 'secret',
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }),
  });

  await assert.rejects(
    () => provider.complete({ systemPrompt: 'system', history: [] }),
    (error) => error instanceof CelineProviderError && error.code === 'timeout'
  );
});
