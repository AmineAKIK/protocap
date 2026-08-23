import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createClientDisconnectSignal } from '../server/requestCancellation.mjs';

class FakeResponse extends EventEmitter {
  writableEnded = false;
}

test('client disconnect signal aborts only when the response closes before completion', () => {
  const response = new FakeResponse();
  const cancellation = createClientDisconnectSignal(response);

  assert.equal(cancellation.signal.aborted, false);
  response.emit('close');
  assert.equal(cancellation.signal.aborted, true);
});

test('normal completed response close does not look like client cancellation', () => {
  const response = new FakeResponse();
  const cancellation = createClientDisconnectSignal(response);

  response.writableEnded = true;
  response.emit('close');
  assert.equal(cancellation.signal.aborted, false);
});

test('disposing the client disconnect boundary removes its listener', () => {
  const response = new FakeResponse();
  const cancellation = createClientDisconnectSignal(response);

  assert.equal(response.listenerCount('close'), 1);
  cancellation.dispose();
  assert.equal(response.listenerCount('close'), 0);
});
