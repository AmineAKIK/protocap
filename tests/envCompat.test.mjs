import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveServerSecret } from '../server/envCompat.mjs';

test('resolveServerSecret prefers the server-only variable', () => {
  assert.equal(
    resolveServerSecret(
      { SHIFTGUIDE_CODE: 'new-code', VITE_SHIFTGUIDE_CODE: 'legacy-code' },
      'SHIFTGUIDE_CODE',
      'VITE_SHIFTGUIDE_CODE'
    ),
    'new-code'
  );
});

test('resolveServerSecret falls back to the legacy Railway variable', () => {
  assert.equal(
    resolveServerSecret(
      { VITE_SHIFTGUIDE_CODE: 'legacy-code' },
      'SHIFTGUIDE_CODE',
      'VITE_SHIFTGUIDE_CODE'
    ),
    'legacy-code'
  );
});

test('resolveServerSecret treats empty primary values as absent', () => {
  assert.equal(
    resolveServerSecret(
      { DEEPSEEK_API_KEY: '', VITE_DEEPSEEK_API_KEY: 'legacy-key' },
      'DEEPSEEK_API_KEY',
      'VITE_DEEPSEEK_API_KEY'
    ),
    'legacy-key'
  );
});

test('resolveServerSecret returns empty when neither variable is configured', () => {
  assert.equal(resolveServerSecret({}, 'SHIFTGUIDE_CODE', 'VITE_SHIFTGUIDE_CODE'), '');
});
