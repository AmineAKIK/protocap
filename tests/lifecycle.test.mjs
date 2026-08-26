import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { installGracefulShutdown } from '../server/lifecycle.mjs';

function createLogger() {
  const entries = [];
  return {
    entries,
    info(event, fields) {
      entries.push({ level: 'info', event, fields });
    },
    error(event, fields) {
      entries.push({ level: 'error', event, fields });
    },
  };
}

function createProcessRef() {
  const emitter = new EventEmitter();
  const exits = [];
  emitter.exit = (code) => exits.push(code);
  emitter.exits = exits;
  return emitter;
}

test('SIGTERM clears cleanup timer, closes server and exits cleanly', () => {
  const logger = createLogger();
  const processRef = createProcessRef();
  const clearedIntervals = [];
  const clearedTimeouts = [];
  const fakeTimer = { unrefCalled: false, unref() { this.unrefCalled = true; } };
  let closeCallback;
  const server = {
    close(callback) {
      closeCallback = callback;
    },
  };

  installGracefulShutdown({
    server,
    cleanupTimer: 'cleanup',
    logger,
    processRef,
    clearIntervalFn: (timer) => clearedIntervals.push(timer),
    setTimeoutFn: () => fakeTimer,
    clearTimeoutFn: (timer) => clearedTimeouts.push(timer),
  });

  processRef.emit('SIGTERM');

  assert.deepEqual(clearedIntervals, ['cleanup']);
  assert.equal(fakeTimer.unrefCalled, true);
  assert.deepEqual(logger.entries[0], {
    level: 'info',
    event: 'server_stopping',
    fields: { signal: 'SIGTERM', shutdownTimeoutMs: 8_000 },
  });
  assert.deepEqual(processRef.exits, []);

  closeCallback();

  assert.deepEqual(processRef.exits, [0]);
  assert.deepEqual(clearedTimeouts, [fakeTimer]);
  assert.deepEqual(logger.entries.at(-1), {
    level: 'info',
    event: 'server_stopped',
    fields: { signal: 'SIGTERM', forced: false, exitCode: 0 },
  });
});

test('shutdown timeout force-closes connections and exits non-zero', () => {
  const logger = createLogger();
  const processRef = createProcessRef();
  let timeoutCallback;
  let closeAllConnectionsCalls = 0;
  const fakeTimer = { unref() {} };
  const server = {
    close() {},
    closeAllConnections() {
      closeAllConnectionsCalls += 1;
    },
  };

  installGracefulShutdown({
    server,
    logger,
    processRef,
    shutdownTimeoutMs: 25,
    setTimeoutFn: (callback) => {
      timeoutCallback = callback;
      return fakeTimer;
    },
    clearTimeoutFn: () => {},
  });

  processRef.emit('SIGINT');
  timeoutCallback();

  assert.equal(closeAllConnectionsCalls, 1);
  assert.deepEqual(processRef.exits, [1]);
  assert.equal(logger.entries.some((entry) => entry.event === 'server_shutdown_timeout'), true);
  assert.deepEqual(logger.entries.at(-1), {
    level: 'info',
    event: 'server_stopped',
    fields: { signal: 'SIGINT', forced: true, exitCode: 1 },
  });
});

test('a second shutdown signal forces immediate termination', () => {
  const logger = createLogger();
  const processRef = createProcessRef();
  let closeAllConnectionsCalls = 0;
  const server = {
    close() {},
    closeAllConnections() {
      closeAllConnectionsCalls += 1;
    },
  };

  installGracefulShutdown({
    server,
    logger,
    processRef,
    setTimeoutFn: () => ({ unref() {} }),
    clearTimeoutFn: () => {},
  });

  processRef.emit('SIGTERM');
  processRef.emit('SIGINT');

  assert.equal(closeAllConnectionsCalls, 1);
  assert.deepEqual(processRef.exits, [1]);
  assert.equal(logger.entries.some((entry) => entry.event === 'server_shutdown_repeated'), true);
});
