# Runtime observability

Protocap uses a deliberately small structured-observability boundary for the current single-process deployment.

The goal is operational diagnosis without turning logs into a second copy of operator or configuration data.

## Invariant

A runtime event may describe **what happened, where in the server boundary, how long it took and how it ended**. It must not contain the data being processed.

In particular, logs must not contain:

- ShiftGuide unlock codes;
- bearer/session tokens;
- DeepSeek API keys or authorization headers;
- operator chat text;
- Celine provider history;
- system-prompt content;
- ShiftGuide modules, action text, lexicon definitions or emergency wording;
- provider response bodies;
- raw client IP addresses;
- arbitrary client-controlled API paths or query strings.

## Structured log envelope

Runtime logs are emitted as one JSON object per line with a stable envelope:

```json
{
  "ts": "2026-08-23T20:00:00.000Z",
  "level": "info",
  "event": "http_request"
}
```

`ts`, `level` and `event` are controlled by the server logger and cannot be overridden by event fields.

## Request correlation

Every `/api` request receives an `X-Request-Id` response header.

A caller-supplied `X-Request-Id` is accepted only when it matches a bounded safe character set and is at most 128 characters. Otherwise the server generates a UUID.

The request ID is an opaque correlation value. It is not a user, session or device identity and must not be derived from a bearer token.

Known API routes are logged by their stable route path. Unknown API paths are collapsed to `/api/*` so arbitrary client path data does not become log content.

## HTTP request event

Completed API responses emit:

```json
{
  "event": "http_request",
  "requestId": "req-123",
  "method": "POST",
  "path": "/api/celine/chat",
  "status": 200,
  "outcome": "completed",
  "durationMs": 412
}
```

If the client connection closes before the response completes, the request is emitted once with:

- `outcome: "client_disconnected"`;
- `status: null`.

The completion listener and close listener share a one-shot guard so the same request cannot generate two HTTP completion events.

## Celine provider event

Celine emits a second event using the same request ID. This isolates provider latency from total HTTP latency.

Successful provider/authority processing:

```json
{
  "event": "celine_provider",
  "requestId": "req-123",
  "outcome": "success",
  "durationMs": 390
}
```

A provider decision that is syntactically invalid or not authorized by the server routing contract is a warning with `outcome: "fallback"` and `code: "invalid_decision"`. No provider prose or rejected decision payload is logged.

A client cancellation is informational with `outcome: "cancelled"`. It is not logged as a provider outage.

Provider failures use `outcome: "error"` and may include:

- the internal provider error code (`timeout`, `rate_limited`, `invalid_response`, `unavailable`, or `unknown`);
- `upstreamStatus` when an HTTP response was actually received from the provider;
- provider-call duration.

The upstream HTTP status is stored as explicit numeric metadata by the provider adapter. The server never parses an exception message to recover it.

Provider response bodies are never logged.

## Clock separation

The domain clock used for session TTL and rate limiting is separate from the telemetry clock used for request/provider durations.

This prevents observability instrumentation from changing authentication, expiry or throttling semantics and keeps deterministic domain-clock tests independent from timing instrumentation.

## Server errors and startup

Unhandled server errors emit `server_error` with the request ID when an API request has one and only the error class name, not the exception message or stack.

Process startup emits `server_started` with bounded runtime metadata. In addition to the listening port and non-secret Celine tuning values, the event includes only these configuration-presence booleans:

- `shiftGuideConfigured`: whether `SHIFTGUIDE_CODE` contains at least one non-whitespace character in the process environment;
- `deepSeekConfigured`: whether `DEEPSEEK_API_KEY` contains at least one non-whitespace character in the process environment.

These fields deliberately expose **presence only**. Secret values, lengths, prefixes, hashes and Railway reference expressions are never logged. Whitespace-only values are treated as unconfigured so the startup signal matches readiness/provider construction semantics. The values themselves are never trimmed or rewritten by this check.

## Deliberate limits

This layer is structured application logging, not a complete observability platform.

It does not currently provide:

- distributed tracing;
- persistent metrics or histograms;
- alerting rules;
- log-retention configuration;
- cross-process correlation beyond an explicitly propagated request ID;
- provider usage/cost accounting.

Those capabilities should be added only when the deployment architecture and operational needs justify them. The current contract is designed so a future collector or metrics layer can consume stable structured events without first redesigning the application logging boundary.
