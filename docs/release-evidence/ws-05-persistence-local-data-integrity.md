# WS-05 — Persistence and local-data integrity evidence

**Status: COMPLETE — browser-state contracts, tests, lifecycle boundaries, and exact production deployment verified**

## Scope

WS-05 audits the browser-local state used by the public demonstrators and ShiftGuide. The objective is resilience and truthful lifecycle semantics, not to turn the demonstrator into a server-persisted collaborative product.

The intended boundary remains explicit: public prototype state and non-sensitive ShiftGuide progress may live in browser storage; ShiftGuide credentials and protected configuration remain session-scoped; no database, cross-device synchronization, or multi-user state service is claimed.

## Findings closed

### 1. Public localStorage hydration now validates runtime schemas

PR #101, merged as `fae2f1a02f593cb07a31e41b1222fc65cb66d9b2`, closed a generic hydration gap in `useLocalStorage<T>()`.

Previously, syntactically valid JSON was accepted through a TypeScript cast even when its runtime shape was incompatible with the page. A persisted Packing object such as `{ "quantity": 30880 }` could therefore reach code that expects string fields and fail during render.

The public persistence boundary now registers runtime validators for all five datasets that use the generic hook:

- Expiry lines;
- Expiry history;
- Logistics requests;
- Packing form inputs;
- Packing shipment progress.

Malformed JSON, structurally invalid JSON, or an unregistered key falls back to the existing safe initial value. The normal persistence effect then rewrites a valid document. Existing `.v8` storage keys remain unchanged because valid data did not require a schema migration.

### 2. Céline persisted history validates the same response authority shape used at runtime

PR #102, merged as `27ed950c74f0ffe345faa70d3806ecd342a09787`, closed a separate persisted-history gap.

The old loader checked that `checklist` was an array but did not validate its elements. Syntactically valid local data such as `checklist: [null]` could therefore pass hydration and fail later when the UI accessed checklist fields.

Céline history now:

- reuses the shared `isCelineResponse()` contract for assistant-owned response structure;
- validates UI-local message/checklist identifiers and `done` / `na` state;
- rejects contradictory `done && na` state;
- rejects loading placeholders from persisted history;
- validates the locally generated user-message shape;
- enforces the shared 20,000-character message and 100-item checklist bounds before iterating checklist contents.

Regression coverage includes malformed checklist elements, oversized checklists, oversized user content, valid assistant restoration, and safe empty-state fallback.

### 3. Céline visible history is bounded for the full ShiftGuide session lifecycle

PR #103, merged as `b08b0004a586c92afa14e60406d2c943401b2541`, closed unbounded growth of the browser-visible conversation document.

The page keeps the full current in-memory conversation while it is open, but browser persistence now retains only the 100 most recent non-loading messages. Hydration likewise considers only the 100 most recent stored entries before structural validation.

This count aligns with the existing server-side 100-message input boundary without changing provider context, which remains independently bounded to four semantic turns. Workflow/procedure state is unaffected because it is persisted separately by workflow `runId`.

### 4. ShiftGuide progress is revision-bound and sanitised

The existing `shared/shiftGuideProgress.js` contract already provides the resilience required by this workstream:

- progress format is explicitly versioned (`PROGRESS_VERSION = 4`);
- stored state must match the active configuration revision;
- action statuses and active choices are sanitised;
- workflow runs are sanitised and bounded to the 50 most recently updated runs;
- V3 progress migrates to V4;
- malformed, stale-revision, or incompatible state resets to a fresh valid document;
- legacy progress keys are removed after successful normalization/migration;
- storage read/write/remove failures do not throw into the UI.

### 5. ShiftGuide session and Céline-history lifecycles are explicit

Protected session material uses `sessionStorage` and fails closed when unavailable or invalid. Non-sensitive progress/history uses the resilient persistent-storage adapter.

`lockShiftGuide()` clears the protected session record and Céline conversational history before best-effort server revocation. Successful unlock also starts a fresh Céline conversational-memory scope. Configuration-revision and Céline-authority-revision reconciliation clear incompatible revision-bound data.

This matches the UI statement that a Céline conversation remains available **during the ShiftGuide session** rather than across independent authenticated sessions.

### 6. Cross-tab behavior matches the demonstrator boundary

ShiftGuide procedure-progress mutations use Web Locks where available so same-origin tabs do not silently overwrite independent read-mutate-write transactions. The fallback is an in-page FIFO queue and explicitly does not claim a cross-tab guarantee when Web Locks are unavailable.

Public demonstrator datasets do not pretend to be collaborative or shared state. The public product boundary states that local prototypes do not simulate nonexistent multi-user synchronization; Logistics explicitly describes its board as browser-local and Packing identifies its tracking as stored on the current device.

No database, distributed lock, shared cache, or cross-device synchronization was introduced because those would exceed the demonstrated product boundary rather than repair a current defect.

## Audit matrix

| Audit item | Result | Evidence |
| --- | --- | --- |
| localStorage key naming and ownership | PASS | Public datasets use named `.v8` keys through `useLocalStorage`; ShiftGuide uses named shared persistence constants and a dedicated storage adapter. |
| Schema/version compatibility | PASS | Public datasets have runtime validators; ShiftGuide progress is V4 and revision-bound; V3 migration is explicit. |
| JSON parse failure handling | PASS | Generic public hydration, Céline history, and shared ShiftGuide progress all catch malformed JSON and return safe state. |
| Invalid/partial persisted state | PASS | PR #101 validates all five public documents; PR #102 validates Céline history; ShiftGuide progress sanitises nested fields. |
| Bounds and numeric validation | PASS | Packing numeric state is validated; shipment progress requires non-negative safe integers; Céline content/checklists/history counts and ShiftGuide workflow runs are bounded. |
| Reset/clear behavior | PASS | Invalid public documents self-heal to defaults; Packing exposes tracking reset; ShiftGuide provides module resets, revision resets, logout cleanup, and fresh Céline history on unlock. |
| Cross-tab expectations | PASS with documented demo boundary | ShiftGuide progress uses Web Locks with a documented single-page fallback; public demo state is explicitly not collaborative. |
| Protected/local separation | PASS | Credentials/config live in fail-closed session storage; non-sensitive progress/history use resilient persistent storage. |
| Secret/token persistence | PASS | ShiftGuide token remains session-scoped and is cleared locally on lock/logout; no public localStorage dataset contains protected credentials. |
| Local vs shared operational-history semantics | PASS | Public pages describe local/device persistence; project-level copy explicitly disclaims nonexistent multi-user synchronization. |

## Exact production verification

The final runtime change for WS-05 was deployed automatically to Railway as deployment `b9353727-dcba-41ad-beaa-6f00ef5aab50`, from exact `main` commit `b08b0004a586c92afa14e60406d2c943401b2541`.

Verified deployment evidence:

- Railway deployment status: `SUCCESS`;
- startup reported `shiftGuideConfigured: true` and `deepSeekConfigured: true` without exposing either secret value;
- `GET /api/ready` completed with HTTP `200` in 4 ms;
- the final PR Quality Gate covered repository checks, production container build, Chromium journeys, mobile Chromium/WebKit smoke, accessibility smoke, and production dependency audit;
- CodeQL completed successfully on the exact reviewed head before merge.

Earlier WS-05 runtime slices were also promoted successfully: PR #101 as Railway deployment `79a594bf-2204-478a-b668-d88a3a0489c9` and PR #102 as deployment `07704d06-1fb7-47f1-ad50-d16bac189a43`.

The final independent public `/api/health` and release-candidate smoke remain WS-18 responsibilities; this workstream does not claim that final release gate has already run.

## Exit criteria

- **Corrupted local persistence cannot break the application irrecoverably:** CLOSED. Public datasets and Céline history reject malformed/incompatible persisted state; ShiftGuide progress normalizes or resets incompatible documents; storage failures have non-throwing/fail-closed policies appropriate to their trust class.
- **Every persisted dataset has an explicit lifecycle and user-visible semantics:** CLOSED. Public prototype state is versioned browser-local demo state; ShiftGuide progress is revision-bound; Céline history is session-scoped, revision-aware, structurally bounded, and cleared at session transitions; protected credentials remain session-only.

## Residual boundaries — not WS-05 blockers

- Public browser-local state is not synchronized across tabs, devices, or users and is not a backend source of truth.
- ShiftGuide Web Locks coordinate same-origin progress only; when unavailable, the fallback cannot guarantee cross-tab serialization and the UI documents the limitation.
- Browser storage quotas and browser privacy/security settings may make non-sensitive persistence unavailable; ShiftGuide degrades to page memory rather than claiming durability.
- The 100-message Céline persistence window intentionally bounds visible-history restoration; the current page may display more messages until it is reloaded or reopened.
- Final external health/smoke verification belongs to WS-18.

**WS-05 release decision: CLOSED.**
