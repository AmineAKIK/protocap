# ShiftGuide browser-storage resilience

ShiftGuide uses browser storage for two different trust classes. They intentionally do not share the same failure policy.

## Authenticated session: fail closed

The ShiftGuide token, protected client payload, expiry, configuration revision and Celine authority revision live in `sessionStorage`.

These values are security-sensitive and form one logical session record. Protocap does not fall back to process memory when `sessionStorage` is unavailable. Unlock writes the complete record, reads it back for verification and rolls back partial writes when any operation fails. Session validation also fails closed if a refreshed expiry cannot be persisted reliably.

Consequences:

- unavailable or blocked `sessionStorage` cannot create a partially unlocked UI;
- a token is never retained in an application-level memory fallback;
- reads that throw are treated as missing credentials;
- cleanup is best-effort because subsequent reads still fail closed.

## Non-sensitive operational state: degrade in memory

Procedure progress, Celine UI history and the ShiftGuide cockpit preference use the resilient persistent-storage boundary in `src/features/shiftguide/shiftGuideStorage.ts`.

When `localStorage` works, behavior remains unchanged. The adapter mirrors values that it reads or writes. If the browser later rejects a read, write, removal or enumeration because storage is blocked, unavailable or over quota, the adapter switches to its in-memory mirror for the remainder of the page lifetime.

This favors continuity over a crash for non-sensitive operator state. It does **not** pretend that the state is durable: ShiftGuide surfaces a warning that changes may be lost after reload.

The fallback is intentionally page-memory only. It is not synchronized across tabs and is not persisted elsewhere.

## Shared persistence contracts

`shared/shiftGuidePersistence.js` and `shared/shiftGuideProgress.js` are also non-throwing when their supplied storage implementation fails. This is defense in depth: future callers cannot accidentally turn a storage exception into a ShiftGuide render failure simply by bypassing the browser adapter.

The browser adapter remains important because it preserves a coherent in-memory mirror after persistence degrades. The shared contracts alone only guarantee safe fallback values and non-throwing behavior.

## What this does not solve

This boundary does not provide transactional multi-tab progress writes. `localStorage` read/modify/write races between tabs remain a separate concurrency concern. It also does not make browser storage a durable database or replace server-side persistence if cross-device or multi-operator state becomes a product requirement.
