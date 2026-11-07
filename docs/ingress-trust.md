# Ingress trust and client identity

Protocap treats reverse-proxy trust as a deployment-boundary concern, not a global Express setting.

## Invariant

Security-sensitive client identity must not depend on an assumed number of proxy hops.

The application therefore does **not** enable Express `trust proxy` globally. `createServerApp()` is safe-by-default and uses the transport socket unless a deployment adapter injects a more specific trust policy.

## Direct/default policy

`DIRECT_INGRESS_TRUST` is the default for tests, local use, and any caller that does not explicitly declare an ingress contract.

- client identity: `req.socket.remoteAddress`
- HTTPS detection: `req.socket.encrypted`
- `X-Real-IP`: ignored
- `X-Forwarded-For`: ignored
- `X-Forwarded-Proto`: ignored

This prevents arbitrary forwarded headers from changing rate-limit identity when the app is reached directly.

## nginx policy

`server.mjs` is the VPS deployment adapter and explicitly injects `NGINX_INGRESS_TRUST`.

That policy relies on the ingress contract established by the repository's nginx configuration (`deploy/nginx/`):

- nginx **overwrites** `X-Real-IP` with `$remote_addr` and `X-Forwarded-Proto` with `$scheme` on every proxied request; client-supplied values never reach the app;
- the app containers publish their port on `127.0.0.1` only, so there is no path that bypasses nginx;
- client identity comes from a syntactically valid `X-Real-IP` value;
- an absent or malformed `X-Real-IP` falls back to the transport socket address;
- `X-Forwarded-For` is deliberately ignored for security decisions;
- HTTPS/HSTS detection uses `X-Forwarded-Proto: https` independently from client identity.

The fallback is conservative. If trusted ingress metadata is unavailable, multiple clients may share a proxy/socket rate-limit bucket, but an untrusted forwarded address cannot create a new bucket and bypass the limiter.

## Why not `trust proxy = 1`

A numeric Express proxy trust policy describes topology by hop count. That assumption is brittle when ingress paths can contain a different number of intermediaries. It also couples unrelated concerns such as `req.ip` and `req.secure` to one generic setting.

Protocap instead keeps the two security decisions explicit:

1. **Who is the client for rate limiting?**
2. **Was the external request HTTPS for browser security headers?**

## Rate-limit scope

The ingress client identity is used only for the existing IP/client rate-limit buckets:

- ShiftGuide unlock attempts;
- the per-client Céline request limiter.

Session-level Céline rate limiting remains keyed by the authenticated session token and is unchanged.

## Deployment compatibility

This policy introduces no new environment variable and requires no variable migration.

The public routes, health/readiness endpoints, provider configuration, session contract, procedures, browser DTOs and Docker runtime contract are unchanged by the ingress policy itself.

## Operational rule

Do not reuse `NGINX_INGRESS_TRUST` behind a proxy that does not overwrite `X-Real-IP`, or if the container port is reachable directly. A new deployment adapter must first establish which ingress headers the platform itself overwrites and whether the application can be reached by a path that bypasses that ingress.
