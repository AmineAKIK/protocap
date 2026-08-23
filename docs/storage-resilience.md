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

## Multi-tab progress writes

Procedure progress is stored as one revision-bound JSON document. A single `localStorage.setItem()` is atomic, but a progress update is a larger `read -> mutate -> write` operation. Without coordination, two tabs can read the same snapshot and the later writer can silently erase the first tab's update.

`src/features/shiftguide/shiftGuideConcurrency.ts` serializes these progress mutations with one named Web Lock for the current origin. The complete transaction runs inside the exclusive lock:

1. read the latest progress document;
2. apply the explicit action intent, active-choice change or reset to that fresh document;
3. write the new complete state;
4. notify local subscribers.

For action buttons, the intent is derived from what the operator actually sees in that tab before the transaction starts. A pending action followed by a `Valider` click becomes an explicit `set validated` operation, not a global toggle evaluated after another tab has already written. This makes identical concurrent intents idempotent while still composing them with unrelated fresh progress under the lock.

This keeps independent action updates from same-origin tabs from overwriting each other. Conflicting explicit intents for the **same** action are intentionally ordered by lock acquisition: the later transaction applies its requested target state to the latest document.

The authentication model is unchanged. `sessionStorage` remains tab-scoped, so another tab must still hold its own valid ShiftGuide session before it can reach protected UI. Web Locks coordinate only the shared non-sensitive progress document; they do not share credentials or create a collaborative multi-user session.

If Web Locks are unavailable or fail before the transaction enters the critical section, ShiftGuide falls back to an in-page FIFO queue. That fallback prevents races inside the current page but cannot provide a cross-tab guarantee. The UI surfaces a warning telling the operator not to modify ShiftGuide in multiple tabs simultaneously. A mutation that throws after entering a Web Lock is propagated and is never replayed automatically.

## Shared persistence contracts

`shared/shiftGuidePersistence.js` and `shared/shiftGuideProgress.js` are also non-throwing when their supplied storage implementation fails. This is defense in depth: future callers cannot accidentally turn a storage exception into a ShiftGuide render failure simply by bypassing the browser adapter.

The browser adapter remains important because it preserves a coherent in-memory mirror after persistence degrades. The shared contracts alone only guarantee safe fallback values and non-throwing behavior.

## What this does not solve

The lock is browser-local and same-origin only. It does not turn browser storage into a server-side source of truth, coordinate different devices or users, provide durable distributed transactions, or replace server persistence if cross-device or genuinely collaborative operational state becomes a product requirement.

When persistent storage itself has degraded to page memory, tabs no longer share the same backing progress state; the existing persistence warning takes precedence over the multi-tab warning because durability is already lost.
