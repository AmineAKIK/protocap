import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSecurityHeaders,
  readServerSecret,
  safeCompareSecrets,
  toClientShiftGuideData,
} from '../server/security.mjs';

test('safeCompareSecrets accepts only the exact configured code', () => {
  assert.equal(safeCompareSecrets('correct-code', 'correct-code'), true);
  assert.equal(safeCompareSecrets('wrong-code', 'correct-code'), false);
  assert.equal(safeCompareSecrets('correct-code ', 'correct-code'), false);
  assert.equal(safeCompareSecrets('', ''), false);
});

test('readServerSecret prefers the server-only variable and keeps legacy compatibility', () => {
  const warnings = [];
  const warn = (message) => warnings.push(message);

  assert.equal(
    readServerSecret(
      { SHIFTGUIDE_CODE: 'primary', VITE_SHIFTGUIDE_CODE: 'legacy' },
      'SHIFTGUIDE_CODE',
      'VITE_SHIFTGUIDE_CODE',
      warn
    ),
    'primary'
  );
  assert.deepEqual(warnings, []);

  assert.equal(
    readServerSecret(
      { VITE_SHIFTGUIDE_CODE: 'legacy-secret-value' },
      'SHIFTGUIDE_CODE',
      'VITE_SHIFTGUIDE_CODE',
      warn
    ),
    'legacy-secret-value'
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /VITE_SHIFTGUIDE_CODE/);
  assert.match(warnings[0], /SHIFTGUIDE_CODE/);
  assert.doesNotMatch(warnings[0], /legacy-secret-value/);
});

test('toClientShiftGuideData never exposes server prompt configuration', () => {
  const clientData = toClientShiftGuideData({
    modules: [{ id: 'm1' }],
    lexique: [{ sigle: 'OC' }],
    urgences: { enabled: true },
    systemPromptExtra: 'server-only instructions',
  });

  assert.deepEqual(clientData, {
    modules: [{ id: 'm1' }],
    lexique: [{ sigle: 'OC' }],
    urgences: { enabled: true },
  });
  assert.equal('systemPromptExtra' in clientData, false);
});

test('buildSecurityHeaders returns strict browser protections without forcing HSTS on HTTP', () => {
  const httpHeaders = buildSecurityHeaders();
  assert.equal(httpHeaders['X-Frame-Options'], 'DENY');
  assert.equal(httpHeaders['X-Content-Type-Options'], 'nosniff');
  assert.match(httpHeaders['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(httpHeaders['Permissions-Policy'], /microphone=\(self\)/);
  assert.equal('Strict-Transport-Security' in httpHeaders, false);

  const httpsHeaders = buildSecurityHeaders({ secure: true });
  assert.equal(httpsHeaders['Strict-Transport-Security'], 'max-age=31536000');
});
