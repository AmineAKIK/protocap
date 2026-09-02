import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSecurityHeaders,
  isConfiguredSecret,
  safeCompareSecrets,
  toClientShiftGuideData,
} from '../server/security.mjs';

test('secret configuration requires at least one non-whitespace character', () => {
  assert.equal(isConfiguredSecret('secret'), true);
  assert.equal(isConfiguredSecret(' secret '), true);
  assert.equal(isConfiguredSecret(''), false);
  assert.equal(isConfiguredSecret('   \t\n'), false);
  assert.equal(isConfiguredSecret(null), false);
});

test('safeCompareSecrets accepts only the exact configured code', () => {
  assert.equal(safeCompareSecrets('correct-code', 'correct-code'), true);
  assert.equal(safeCompareSecrets('wrong-code', 'correct-code'), false);
  assert.equal(safeCompareSecrets('correct-code ', 'correct-code'), false);
  assert.equal(safeCompareSecrets('', ''), false);
  assert.equal(safeCompareSecrets('   ', '   '), false);
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
