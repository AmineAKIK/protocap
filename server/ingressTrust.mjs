import { isIP } from 'node:net';

function socketAddress(req) {
  return typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress.length > 0
    ? req.socket.remoteAddress
    : 'unknown';
}

function validIpHeader(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return isIP(candidate) !== 0 ? candidate : null;
}

export const DIRECT_INGRESS_TRUST = Object.freeze({
  clientAddress(req) {
    return socketAddress(req);
  },
  isSecure(req) {
    return Boolean(req.socket?.encrypted);
  },
});

export const RAILWAY_INGRESS_TRUST = Object.freeze({
  clientAddress(req) {
    return validIpHeader(req.get('x-real-ip')) ?? socketAddress(req);
  },
  isSecure(req) {
    return req.get('x-forwarded-proto')?.trim().toLowerCase() === 'https';
  },
});
