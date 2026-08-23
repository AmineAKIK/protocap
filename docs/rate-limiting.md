# Runtime rate limiting

Protocap applies process-local rate limits to the ShiftGuide unlock endpoint and to Celine chat requests.

## Invariant

A client must not receive a fresh full quota merely because the first request that opened an older fixed window has expired.

The limiter therefore uses an exact sliding window: at time `now`, only request timestamps strictly newer than `now - windowMs` count toward the quota.

## Current policies

- ShiftGuide unlock: 10 attempts per client address in any rolling 10-minute window.
- Celine chat per authenticated session: 30 requests in any rolling 60-second window.
- Celine chat per client address: 60 requests in any rolling 60-second window.

Client-address identity is supplied by the ingress trust policy documented in `docs/ingress-trust.md`. The rate limiter itself does not parse proxy headers.

## Storage model

Each limiter key stores only timestamps that can still influence admission. The number of stored timestamps is bounded by that key's quota, currently at most 60.

No timer is created per client. Existing periodic runtime cleanup removes stale orphaned entries using the entry's earliest possible reset time.

## Retry-After

When a quota is full, `Retry-After` is derived from the oldest active request timestamp. The advertised delay is the minimum whole-second delay after which at least one request slot is expected to become available.

The existing HTTP status and response bodies remain unchanged.

## Why not token bucket

A token bucket intentionally permits bursts up to its configured capacity. Backlog 13 is specifically about eliminating the double-burst possible at a fixed-window boundary, so an exact sliding window matches the existing quota language more directly and avoids introducing new capacity/refill semantics.

## Deliberate limits

The limiter is process-local. Restarting the process clears limiter state, and multiple application instances would not share quota state. This matches the existing runtime architecture and this change does not introduce Redis or another distributed store.

If Protocap is later scaled horizontally and the security requirement becomes a quota across all instances, rate-limit state will need a shared authority. That is a separate architectural change from fixing fixed-window boundary behavior.
