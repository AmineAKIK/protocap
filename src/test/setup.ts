import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
});
