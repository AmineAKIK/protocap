import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECT_INGRESS_TRUST,
  RAILWAY_INGRESS_TRUST,
} from '../server/ingressTrust.mjs';

function request({ headers = {}, remoteAddress = '10.0.0.8', encrypted = false } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
  return {
    socket: { remoteAddress, encrypted },
    get(name) {
      return normalizedHeaders[name.toLowerCase()];
    },
  };
}

test('direct ingress trust uses only the transport socket', () => {
  const req = request({
    headers: {
      'X-Real-IP': '203.0.113.10',
      'X-Forwarded-For': '198.51.100.4',
      'X-Forwarded-Proto': 'https',
    },
    remoteAddress: '127.0.0.1',
    encrypted: false,
  });

  assert.equal(DIRECT_INGRESS_TRUST.clientAddress(req), '127.0.0.1');
  assert.equal(DIRECT_INGRESS_TRUST.isSecure(req), false);
});

test('Railway ingress trust accepts only a valid X-Real-IP for client identity', () => {
  assert.equal(
    RAILWAY_INGRESS_TRUST.clientAddress(request({
      headers: { 'X-Real-IP': ' 203.0.113.10 ' },
    })),
    '203.0.113.10'
  );
  assert.equal(
    RAILWAY_INGRESS_TRUST.clientAddress(request({
      headers: { 'X-Real-IP': '2001:db8::42' },
    })),
    '2001:db8::42'
  );
});

test('Railway ingress trust ignores X-Forwarded-For and fails conservatively to the socket', () => {
  const req = request({
    headers: {
      'X-Real-IP': 'not-an-ip',
      'X-Forwarded-For': '203.0.113.99',
    },
    remoteAddress: '10.0.0.25',
  });

  assert.equal(RAILWAY_INGRESS_TRUST.clientAddress(req), '10.0.0.25');
});

test('Railway ingress trust derives HTTPS independently from proxy hop count', () => {
  assert.equal(
    RAILWAY_INGRESS_TRUST.isSecure(request({ headers: { 'X-Forwarded-Proto': ' https ' } })),
    true
  );
  assert.equal(
    RAILWAY_INGRESS_TRUST.isSecure(request({ headers: { 'X-Forwarded-Proto': 'http' } })),
    false
  );
  assert.equal(RAILWAY_INGRESS_TRUST.isSecure(request()), false);
});
