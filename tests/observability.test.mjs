import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';
import {
  createRequestId,
  createStructuredLogger,
} from '../server/observability.mjs';
import { CelineProviderError } from '../server/providers/deepSeekProvider.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';
import { TEST_CELINE_ROUTING_SPEC } from './celineRoutingFixture.mjs';

const shiftGuideConfig = {
  modules: [
    {
      id: 'module_standard',
      title: 'Module standard',
      description: 'Test observability',
      type: 'standard',
      actions: [{ id: 'action_1', text: 'Faire le contrôle' }],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

function createLogCapture() {
  const events = [];
  const sink = (line) => events.push(JSON.parse(line));
  return {
    events,
    logger: { info: sink, warn: sink, error: sink },
  };
}

async function withServer(options, run) {
  const { app } = createServerApp({
    shiftGuideCode: 'access-code-secret',
    shiftGuideConfig,
    celineRoutingSpec: TEST_CELINE_ROUTING_SPEC,
    issueToken: () => 'session-token-secret',
    ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function unlock(baseUrl) {
  const response = await fetch(`${baseUrl}/api/shiftguide/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'access-code-secret' }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('request ids accept a bounded safe value and replace unsafe input', () => {
  assert.equal(createRequestId('client-request_123'), 'client-request_123');
  assert.match(createRequestId('bad request id with spaces'), /^[0-9a-f-]{36}$/);
  assert.match(createRequestId('x'.repeat(129)), /^[0-9a-f-]{36}$/);
});

test('structured logger emits one JSON object without changing field types', () => {
  const lines = [];
  const logger = createStructuredLogger({ info(line) { lines.push(line); } });
  logger.info('sample_event', { requestId: 'req-1', durationMs: 12, status: 200 });

  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.level, 'info');
  assert.equal(event.event, 'sample_event');
  assert.equal(event.requestId, 'req-1');
  assert.equal(event.durationMs, 12);
  assert.equal(event.status, 200);
  assert.match(event.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('API responses expose a correlation id and unknown paths are bucketed safely', async () => {
  const capture = createLogCapture();
  await withServer({ logger: capture.logger }, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Request-Id': 'health-req-1' },
    });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-request-id'), 'health-req-1');
    await health.json();

    const unknown = await fetch(`${baseUrl}/api/operator-secret-path?token=hidden`);
    assert.equal(unknown.status, 404);
    await unknown.json();
    await new Promise((resolve) => setImmediate(resolve));
  });

  const healthLog = capture.events.find(
    (event) => event.event === 'http_request' && event.requestId === 'health-req-1'
  );
  assert.ok(healthLog);
  assert.equal(healthLog.path, '/api/health');
  assert.equal(healthLog.status, 200);
  assert.equal(healthLog.outcome, 'completed');
  assert.equal(typeof healthLog.durationMs, 'number');

  const unknownLog = capture.events.find(
    (event) => event.event === 'http_request' && event.status === 404
  );
  assert.ok(unknownLog);
  assert.equal(unknownLog.path, '/api/*');
  assert.doesNotMatch(JSON.stringify(unknownLog), /operator-secret-path|token=hidden/);
});

test('Celine provider logs safe upstream status and never log operator text, tokens or secrets', async () => {
  const capture = createLogCapture();
  const celineProvider = {
    async complete() {
      throw new CelineProviderError('unavailable', 'DeepSeek returned 401.', {
        upstreamStatus: 401,
      });
    },
  };

  await withServer({ logger: capture.logger, celineProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    assert.equal(unlocked.token, 'session-token-secret');

    const response = await fetch(`${baseUrl}/api/celine/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unlocked.token}`,
        'X-Request-Id': 'celine-req-401',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'OPERATOR_SECRET_TEXT' }],
      }),
    });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('x-request-id'), 'celine-req-401');
    await response.json();
    await new Promise((resolve) => setImmediate(resolve));
  });

  const providerLog = capture.events.find(
    (event) => event.event === 'celine_provider' && event.requestId === 'celine-req-401'
  );
  assert.ok(providerLog);
  assert.equal(providerLog.level, 'error');
  assert.equal(providerLog.outcome, 'error');
  assert.equal(providerLog.code, 'unavailable');
  assert.equal(providerLog.upstreamStatus, 401);
  assert.equal(typeof providerLog.durationMs, 'number');

  const requestLog = capture.events.find(
    (event) => event.event === 'http_request' && event.requestId === 'celine-req-401'
  );
  assert.ok(requestLog);
  assert.equal(requestLog.path, '/api/celine/chat');
  assert.equal(requestLog.status, 502);

  const serialized = JSON.stringify(capture.events);
  assert.doesNotMatch(serialized, /OPERATOR_SECRET_TEXT/);
  assert.doesNotMatch(serialized, /session-token-secret/);
  assert.doesNotMatch(serialized, /access-code-secret/);
  assert.doesNotMatch(serialized, /DeepSeek returned 401/);
});
