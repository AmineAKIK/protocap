import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class TestLockManager {
  private readonly tails = new Map<string, Promise<void>>();

  request<T>(
    name: string,
    options: { signal?: AbortSignal } | (() => Promise<T> | T),
    maybeCallback?: () => Promise<T> | T,
  ): Promise<T> {
    const callback = typeof options === 'function' ? options : maybeCallback!;
    const signal = typeof options === 'function' ? undefined : options.signal;
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const previous = this.tails.get(name) ?? Promise.resolve();
    const run = previous.then(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return callback();
    });
    this.tails.set(name, run.then(() => undefined, () => undefined));
    return run;
  }
}

function installTestLocks() {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: new TestLockManager(),
  });
}

installTestLocks();

// jsdom does not implement these native dialog methods. Match the existing
// AccessibleDialog test shim for real-page integration; browser tests still
// exercise the native top layer, focus behavior and accessibility tree.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  installTestLocks();
});
