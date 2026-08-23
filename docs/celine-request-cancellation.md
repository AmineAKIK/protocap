# Celine request cancellation

Celine requests cross three cancellation boundaries:

1. the React page owns the browser `AbortController`;
2. Express observes whether the HTTP response connection closes before completion;
3. the DeepSeek adapter combines client cancellation with its own provider timeout.

These signals have different meanings and must not be collapsed into one generic provider failure.

## Browser lifecycle

Each in-flight Celine request already uses an `AbortController` whose signal is passed to `fetch('/api/celine/chat')`.

The Celine page now aborts that controller when the page unmounts. This covers SPA navigation away from Celine as well as the existing explicit conversation reset path. Aborting a browser request is treated as cancellation, not as a user-visible AI error.

Conversation history remains governed separately by the ShiftGuide session-history contract. Cancelling a request does not clear previously persisted conversation history.

## Express lifecycle

`server/requestCancellation.mjs` creates one cancellation boundary around each provider-backed Celine request.

The boundary listens to the HTTP response `close` event and aborts only when the response has not already completed. A normal response close therefore does not look like client cancellation.

The listener is disposed after the provider call completes or fails so request listeners do not accumulate.

If the client disconnects while the provider is still running:

- the provider signal is aborted;
- no Celine provider context is appended for that unfinished turn;
- the disconnect is not logged as a DeepSeek outage;
- the server does not attempt to manufacture a `502` response for a socket that is already gone.

## Provider lifecycle

The DeepSeek adapter receives an optional external signal and combines it with `AbortSignal.timeout(45_000)` using `AbortSignal.any()`.

The adapter preserves separate internal error codes:

- `cancelled`: the HTTP client disappeared;
- `timeout`: DeepSeek exceeded the provider timeout;
- `rate_limited`: upstream HTTP 429;
- `invalid_response`: an otherwise completed response was malformed;
- `unavailable`: network or other upstream failures.

Cancellation is checked both while awaiting the initial fetch and while consuming the response JSON body. This prevents a client abort during body parsing from being misclassified as an invalid provider payload.

## Why cancellation is not an HTTP API status

There is intentionally no new public `499` or similar response contract. The only cancellation source currently propagated to the provider is the client connection itself; once that signal fires, there is no reliable consumer for a new HTTP response.

Existing successful and error responses remain unchanged for connected clients.

## What this does not do

This mechanism does not cancel already-completed provider work, does not implement provider-side billing guarantees, and does not change DeepSeek retention behavior. It only stops work as soon as the cancellation can be observed by the current process and propagated through the standard fetch abort signal.

It also does not turn transient DeepSeek availability into deployment readiness. `/api/ready` remains a local bootstrap-readiness check, while runtime provider availability continues to be handled by the Celine request path.
