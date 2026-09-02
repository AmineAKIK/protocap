# Runtime liveness and deployment readiness

Protocap exposes two health endpoints with deliberately different semantics.

## `/api/health` — liveness

`GET /api/health` answers `200 { "ok": true }` when the Express process can serve HTTP.

It intentionally does not inspect ShiftGuide configuration or the AI provider. This keeps liveness suitable for diagnostics and backwards-compatible callers: a configuration problem must not masquerade as a dead process.

## `/api/ready` — deployment readiness

`GET /api/ready` describes whether the current process has the local capabilities expected by the hosted Protocap deployment.

A ready process requires:

- ShiftGuide access to be configured with a code containing at least one non-whitespace character;
- the ShiftGuide client payload, configuration revision, Celine authority revision, routing authority and system prompt to have been constructed successfully;
- a callable Celine provider adapter to be present. The DeepSeek adapter is not created when its API key is missing or whitespace-only.

The response contains only capability booleans:

```json
{
  "ok": true,
  "checks": {
    "shiftGuide": true,
    "celine": true
  }
}
```

When one of the required capabilities is unavailable, the endpoint returns HTTP `503` with the same boolean-only shape. It never returns secrets, environment-variable names, configuration hashes, provider credentials or validation details.

The snapshot is derived once during application construction. Invalid ShiftGuide/routing configuration already fails startup when ShiftGuide is enabled; readiness covers missing required bootstrap capabilities that would otherwise leave the process alive but functionally incomplete. Whitespace-only protected credentials are treated as missing rather than as configured values; this presence check does not trim or rewrite valid secret values.

## Why readiness does not call DeepSeek

Readiness is a deployment gate, not continuous upstream monitoring. It verifies that the provider adapter exists but does not make a network request to DeepSeek.

This is intentional:

- an upstream outage should not make a correct Protocap build fail deployment or trigger restart loops;
- health probes must be fast and deterministic;
- provider availability belongs in runtime observability and request error metrics, not in process readiness.

A configured but invalid/expired provider credential can therefore pass deployment readiness and later fail a real Celine request. That is a separate observability concern.

## Railway

The Railway production service configures `/api/ready` as its deployment healthcheck with a 60-second timeout and an `ON_FAILURE` restart policy with three retries. These operational settings live on the Railway service rather than in the deprecated `railway.toml` config-as-code format.

The repository root `Dockerfile` is the build/runtime source of truth. Railway automatically detects it and builds that image before applying the service-level healthcheck. `/api/health` remains available as the process-liveness endpoint.

This distinction does not turn Protocap into a distributed or highly available system. Sessions and rate-limit/provider context remain process-local as documented in the architecture.
