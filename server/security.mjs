import { createHash, timingSafeEqual } from 'node:crypto';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

function digestSecret(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function safeCompareSecrets(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || expected.length === 0) {
    return false;
  }

  return timingSafeEqual(digestSecret(candidate), digestSecret(expected));
}

export function toClientShiftGuideData(config) {
  return {
    modules: config.modules,
    lexique: config.lexique,
    urgences: config.urgences,
  };
}

export function buildSecurityHeaders({ secure = false } = {}) {
  const headers = {
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };

  if (secure) {
    headers['Strict-Transport-Security'] = 'max-age=31536000';
  }

  return headers;
}
