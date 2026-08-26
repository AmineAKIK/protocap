# Runtime lifecycle and graceful shutdown

Protocap treats process termination as part of the production runtime contract rather than relying on the platform to kill the container abruptly.

## Signal contract

`server.mjs` keeps the Node HTTP server returned by `app.listen()` and installs handlers for `SIGTERM` and `SIGINT` through `server/lifecycle.mjs`.

On the first shutdown signal the process:

1. records `server_stopping` with the signal and drain budget;
2. clears the periodic in-memory state cleanup timer;
3. calls `server.close()` so the listener stops accepting new connections while existing HTTP work can finish;
4. arms a bounded 8 second application shutdown timer;
5. records `server_stopped` and exits with code 0 when the HTTP server closes normally.

If the HTTP server has not closed within 8 seconds, the lifecycle guard records `server_shutdown_timeout`, calls `server.closeAllConnections()` when available, records a forced `server_stopped`, and exits non-zero. A second termination signal during draining also forces immediate termination instead of restarting another shutdown sequence.

Shutdown logs contain lifecycle metadata only. They do not include request bodies, protected configuration, credentials, session tokens or provider payloads.

## Railway draining

Railway sends `SIGTERM` to the old deployment after the replacement deployment becomes active. The production service sets:

```text
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=10
```

The platform window is deliberately longer than Protocap's 8 second application timeout. This gives the application time to complete or force its own bounded shutdown before Railway can issue `SIGKILL`.

This value is deployment configuration rather than an application secret. It was added without triggering an immediate redeploy; it applies to subsequent deployment teardown.

## Scope

This lifecycle hardening is intentionally process-local. It does not add distributed coordination, external session state, multiple replicas or background job orchestration. Those remain outside the current demonstrator architecture.

## Verification

`tests/lifecycle.test.mjs` covers:

- normal `SIGTERM` cleanup and exit;
- bounded forced shutdown when the server does not close;
- immediate forced termination on a repeated signal.

The standard `npm run check` path executes these tests, and the production Docker image is still built by the GitHub Quality Gate.
