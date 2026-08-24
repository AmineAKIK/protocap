import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CelineProviderError,
  createDeepSeekProvider,
} from '../server/providers/deepSeekProvider.mjs';

test('DeepSeek adapter owns provider request shape and returns content plus usage telemetry', async () => {
  let captured;
  const provider = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{ message: { content: '{"kind":"route","id":"production"}' }, finish_reason: 'stop' }],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 18,
              total_tokens: 138,
              prompt_cache_hit_tokens: 80,
              prompt_cache_miss_tokens: 40,
            },
          };
        },
      };
    },
  });

  const result = await provider.complete({
    systemPrompt: 'system',
    history: [{ role: 'user', content: 'bonjour' }],
  });

  assert.equal(result.content, '{"kind":"route","id":"production"}');
  assert.equal(result.model, 'deepseek-v4-flash');
  assert.equal(result.finishReason, 'stop');
  assert.deepEqual(result.usage, {
    promptTokens: 120,
    completionTokens: 18,
    totalTokens: 138,
    promptCacheHitTokens: 80,
    promptCacheMissTokens: 40,
  });
  assert.equal(captured.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, 'deepseek-v4-flash');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.max_tokens, 160);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'bonjour' },
  ]);
});

test('DeepSeek adapter tolerates missing usage telemetry', async () => {
  const provider = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: '{"kind":"unknown"}' } }] };
      },
    }),
  });
  const result = await provider.complete({ systemPrompt: 'x', history: [] });
  assert.equal(result.usage, null);
});

test('DeepSeek adapter maps upstream HTTP failures with safe status metadata', async () => {
  const rateLimited = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(
    () => rateLimited.complete({ systemPrompt: 'x', history: [] }),
    (error) => (
      error instanceof CelineProviderError &&
      error.code === 'rate_limited' &&
      error.upstreamStatus === 429
    )
  );

  const unauthorized = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(
    () => unauthorized.complete({ systemPrompt: 'x', history: [] }),
    (error) => (
      error instanceof CelineProviderError &&
      error.code === 'unavailable' &&
      error.upstreamStatus === 401
    )
  );
});

test('DeepSeek adapter keeps upstream success status on invalid provider payloads', async () => {
  const malformed = createDeepSeekProvider({
    apiKey: 'secret',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() { return { choices: [] }; },
    }),
  });
  await assert.rejects(
    () => malformed.complete({ systemPrompt: 'x', history: [] }),
    (error) => (
      error instanceof CelineProviderError &&
      error.code === 'invalid_response' &&
      error.upstreamStatus === 200
    )
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
    (error) => (
      error instanceof CelineProviderError &&
      error.code === 'cancelled' &&
      error.upstreamStatus === null
    )
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
    (error) => (
      error instanceof CelineProviderError &&
      error.code === 'timeout' &&
      error.upstreamStatus === null
    )
  );
});
